/*
 * Sozi - A presentation tool using the SVG standard
 *
 * Copyright (C) 2010-2011 Guillaume Savaton
 *
 * This program is dual licensed under the terms of the MIT license
 * or the GNU General Public License (GPL) version 3.
 * A copy of both licenses is provided in the doc/ folder of the
 * official release of Sozi.
 * 
 * See http://sozi.baierouge.fr/wiki/en:license for details.
 */

this.addEventListener("load", function () {
	var	svgNs = "http://www.w3.org/2000/svg",
	    soziNs = "http://sozi.baierouge.fr",
		xhtmlNs = "http://www.w3.org/1999/xhtml",
		window = this,
		document = window.document,
		videoSources = document.getElementsByTagNameNS(soziNs, "video"),
		videos, i, j, rect, foreignObject,
		html, htmlVideo, htmlSource;

	videos = [];
	for (i = 0; i < videoSources.length; i += 1) {
		rect = videoSources[i].parentNode;
	
		// Create HTML video source element
		htmlSource = document.createElementNS(xhtmlNs, "source");
		htmlSource.setAttribute("type", videoSources[i].getAttribute("type"));
		htmlSource.setAttribute("src", videoSources[i].getAttribute("src"));

		for (j = 0; j < videos.length; j += 1) {
			if (videos[j].rect === rect) {
				break;
			}
		}
	
		if (j === videos.length) {
			// Create HTML video element
			htmlVideo = document.createElementNS(xhtmlNs, "video");
			// htmlVideo.setAttribute("poster", "__dummy__.png");
			// htmlVideo.setAttribute("controls", "controls");
			htmlVideo.setAttribute("width", rect.getAttribute("width"));
			htmlVideo.setAttribute("height", rect.getAttribute("height"));
		
			// Create HTML root element
			html = document.createElementNS(xhtmlNs, "html");
			html.appendChild(htmlVideo);
		
			// Create SVG foreign object
			foreignObject = document.createElementNS(svgNs, "foreignObject");
			foreignObject.setAttribute("x", rect.getAttribute("x"));
			foreignObject.setAttribute("y", rect.getAttribute("y"));
			foreignObject.setAttribute("width", rect.getAttribute("width"));
			foreignObject.setAttribute("height", rect.getAttribute("height"));
			foreignObject.appendChild(html);
				
			rect.parentNode.insertBefore(foreignObject, rect.nextSibling);
				
			videos.push({
				rect: videoSources[i].parentNode,
				htmlVideo: htmlVideo
			});
		}
	
		// Append HTML source element to current HTML video element
		videos[j].htmlVideo.appendChild(htmlSource);
	}				
}, false);
