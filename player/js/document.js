/*
* Sozi - A presentation tool using the SVG standard
*
* Copyright (C) 2010-2013 Guillaume Savaton
*
* This program is dual licensed under the terms of the MIT license
* or the GNU General Public License (GPL) version 3.
* A copy of both licenses is provided in the doc/ folder of the
* official release of Sozi.
*
* See http://sozi.baierouge.fr/wiki/en:license for details.
*/

/**
 * @name sozi.document
 * @namespace Document analysis.
 * @depend namespace.js
 */
namespace(this, "sozi.document", function (exports, window) {
    "use strict";
    
    // An alias to the global document object
    var document = context.document;
    
    // Constant: the Sozi namespace
    var SOZI_NS = "http://sozi.baierouge.fr";
    
    // Constant: the default frame properties, if missing in the SVG document
    var DEFAULTS = {
        "title": "Untitled",
        "sequence": "0",
        "hide": "true",
        "clip": "true",
        "show-in-frame-list": "true",
        "timeout-enable": "false",
        "timeout-ms": "5000",
        "transition-duration-ms": "1000",
        "transition-zoom-percent": "0",
        "transition-profile": "linear",
        "transition-path-hide": "true"
    };

    var DRAWABLE_TAGS = [ "g", "image", "path", "rect", "circle",
        "ellipse", "line", "polyline", "polygon", "text", "clippath" ];

    // The definitions of all valid frames in the current document
    exports.frames = [];
    
    // The list of layer ids managed by Sozi
    exports.idLayerList = [];
    
    /*
    * Returns the value of an attribute of a given Sozi SVG element.
    *
    * If the attribute is empty or does not exist,
    * then a default value is returned (See DEFAULTS).
    */
    function readAttribute(soziElement, attr) {
        return soziElement.getAttributeNS(SOZI_NS, attr) || DEFAULTS[attr];
    }

    function readStateForLayer(frame, idLayer, soziElement) {
        var state = frame.states[idLayer] =
            frame.states[idLayer] || context.sozi.display.CameraState.instance();
        
        if (typeof state.transitionZoomPercent === "undefined" || soziElement.hasAttributeNS(SOZI_NS, "transition-zoom-percent")) {
            state.setTransitionZoomPercent(parseInt(readAttribute(soziElement, "transition-zoom-percent"), 10));
        }

        if (typeof state.transitionProfile === "undefined" || soziElement.hasAttributeNS(SOZI_NS, "transition-profile")) {
            state.setTransitionProfile(context.sozi.animation.profiles[readAttribute(soziElement, "transition-profile")]);
        }
        
        if (typeof state.transitionPath === "undefined" || soziElement.hasAttributeNS(SOZI_NS, "transition-path")) {
            var svgPath = targetNode.document.getElementById(soziElement.getAttributeNS(SOZI_NS, "transition-path"));
            if (svgPath && svgPath.nodeName === "path") {
                state.setTransitionPath(svgPath);
                if (readAttribute(soziElement, "transition-path-hide") === "true") {
                    svgPath.style.visibility = "hidden";
                }
            }
        }
        
        if (soziElement.hasAttributeNS(SOZI_NS, "refid")) {
            var svgElement = targetNode.document.getElementById(soziElement.getAttributeNS(SOZI_NS, "refid"));
            if (svgElement) {
                state.setAtElement(svgElement);
                if (readAttribute(soziElement, "hide") === "true") {
                    svgElement.style.visibility = "hidden";
                }
            }
        }
            
        if (soziElement.hasAttributeNS(SOZI_NS, "clip")) {
            state.setClipped(readAttribute(soziElement, "clip") === "true");
        }
    }
    
    /*
    * Builds the list of frames from the current document.
    *
    * This method collects all elements with tag "sozi:frame" and
    * retrieves their geometrical and animation attributes.
    * SVG elements that should be hidden during the presentation are hidden.
    *
    * The resulting list is available in frames, sorted by frame indices.
    */
    function readFrames() {
        // Collect all group ids referenced in <layer> elements
        var idLayerRefList = [];
        var soziLayerList = targetNode.document.getElementsByTagNameNS(SOZI_NS, "layer");
        for (var i = 0; i < soziLayerList.length; i += 1) {
            var idLayer = soziLayerList[i].getAttributeNS(SOZI_NS, "group");
            if (idLayer && idLayerRefList.indexOf(idLayer) === -1) {
                idLayerRefList.push(idLayer);
            }
        }

        // Reorganize the document, grouping objects that do not belong
        // to a group referenced in <layer> elements
        var SVG_NS = "http://www.w3.org/2000/svg";

        // Create the first wrapper group
        var svgWrapper = targetNode.document.createElementNS(SVG_NS, "g");

        // For each child of the root SVG element
        var svgElementList = Array.prototype.slice.call(svgRoot.childNodes);
        svgElementList.forEach(function (svgElement, index) {
            if (!svgElement.getAttribute) {
                // Remove text elements
                svgRoot.removeChild(svgElement);
            }
            else if (idLayerRefList.indexOf(svgElement.getAttribute("id")) !== -1) {
                // If the current element is a referenced layer ...
                if (svgWrapper.firstChild) {
                    // ... and if there were other non-referenced elements before it,
                    // append the wrapper group to the <defs> element
                    svgWrapper.setAttribute("id", "sozi-wrapper-" + index);
                    exports.idLayerList.push("sozi-wrapper-" + index);
                    svgRoot.insertBefore(svgWrapper, svgElement);
                    
                    // Prepare a new wrapper element
                    svgWrapper = targetNode.document.createElementNS(SVG_NS, "g");
                }
                
                // ... append the current element to the <defs> element
                exports.idLayerList.push(svgElement.getAttribute("id"));
            }
            else if (DRAWABLE_TAGS.indexOf(svgElement.localName.toLowerCase()) !== -1) {
                // If the current element is not a referenced layer
                // and is drawable, move it to the current wrapper element
                svgRoot.removeChild(svgElement);
                svgWrapper.appendChild(svgElement);
            }
        });

        // Append last wrapper if needed
        if (svgWrapper.firstChild) {
            svgWrapper.setAttribute("id", "sozi-wrapper-" + svgElementList.length);
            exports.idLayerList.push("sozi-wrapper-" + svgElementList.length);
            svgRoot.appendChild(svgWrapper);
        }

        
        // Analyze <frame> elements sorted by sequence number
        var soziFrameList = Array.prototype.slice.call(targetNode.document.getElementsByTagNameNS(SOZI_NS, "frame"));
        soziFrameList.sort(
            function (a, b) {
                var seqA = parseInt(readAttribute(a, "sequence"), 10);
                var seqB = parseInt(readAttribute(b, "sequence"), 10)
                return seqA - seqB;
            }
        );
        
        function createNewSVGReferenceFromFrame(soziFrame) {
            var svgElement = soziFrame.ownerDocument.getElementById(soziFrame.getAttributeNS(SOZI_NS,"refid"));
            
            if(svgElement != null) {
                var svgDescriptionElement = svgElement.getElementsByTagName("desc")[0];
                var newSVG = {
                  id:svgElement.getAttribute("id")
                };
                if(svgDescriptionElement != null) {
                  newSVG.description = {
                    id:svgDescriptionElement.getAttribute("id"),
                    text:svgDescriptionElement.innerHTML
                  }
                }

                return newSVG;
            }
            return null;
        }

        soziFrameList.forEach(function (soziFrame, indexFrame) {

            var newFrame = {
                id: soziFrame.getAttribute("id"),
                svg: createNewSVGReferenceFromFrame(soziFrame),
                title: readAttribute(soziFrame, "title"),
                showInFrameList: readAttribute(soziFrame, "show-in-frame-list") === "true",
                sequence: parseInt(readAttribute(soziFrame, "sequence"), 10),
                timeoutEnable: readAttribute(soziFrame, "timeout-enable") === "true",
                timeoutMs: parseInt(readAttribute(soziFrame, "timeout-ms"), 10),
                transitionDurationMs: parseInt(readAttribute(soziFrame, "transition-duration-ms"), 10),
                states: {}
            };

            // Get the default properties for all layers, either from
            // the current <frame> element or from the corresponding
            // layer in the previous frame.
            // Those properties can later be overriden by <layer> elements
            exports.idLayerList.forEach(function (idLayer) {
                if (indexFrame === 0 || idLayer.search("sozi-wrapper-[0-9]+") !== -1) {
                    // In the first frame, or in wrapper layers,
                    // read layer attributes from the <frame> element
                    readStateForLayer(newFrame, idLayer, soziFrame);
                }
                else {
                    // After the first frame, in referenced layers,
                    // copy attributes from the corresponding layer in the previous frame
                    var currentState = newFrame.states[idLayer] = context.sozi.display.CameraState.instance();
                    var previousState = exports.frames[exports.frames.length - 1].states[idLayer];
                    currentState.setAtState(previousState);
                }
            });

            // Collect and analyze <layer> elements in the current <frame> element
            var soziLayerList = Array.prototype.slice.call(soziFrame.getElementsByTagNameNS(SOZI_NS, "layer"));
            soziLayerList.forEach(function (soziLayer) {
                var idLayer = soziLayer.getAttributeNS(SOZI_NS, "group");
                if (idLayer && exports.idLayerList.indexOf(idLayer) !== -1) {
                    readStateForLayer(newFrame, idLayer, soziLayer);
                }
            });
            
            // If the <frame> element has at least one valid layer,
            // add it to the frame list
            for (var idLayer in newFrame.states) {
                if (newFrame.states.hasOwnProperty(idLayer)) {
                    exports.frames.push(newFrame);
                    break;
                }
            }
        });
    }

    /**
     * Return the frame with the given id.
     *
     * @return The index of the frame with the given id. -1 if not found.
     */
    exports.getFrameIndexForId = function (idFrame) {
        for (var indexFrame = 0; indexFrame < exports.frames.length; indexFrame += 1) {
            if (exports.frames[indexFrame].id === idFrame) {
                return indexFrame;
            }
        }
        return - 1;
    };
    
    /*
     * Event handler: document load.
     *
     * This function reads the frames from the document and fires
     * the "documentready" event.
     *
     * @depend events.js
     */
    function onLoad() {
        svgRoot.removeAttribute("viewBox");
        readFrames();
        context.sozi.events.fire("sozi.document.ready");
    }

    targetNode.addEventListener("load",onLoad,false);
});
