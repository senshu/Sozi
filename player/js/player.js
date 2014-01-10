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
 * @name sozi.player
 * @namespace Presentation player.
 * @depend namespace.js
 */
namespace(this, "sozi.player", function (exports, window) {
    "use strict";
    
    var viewPort;
    
    // The animator object used to animate transitions
    var animator;
    
    // The handle returned by setTimeout() for frame timeout
    var nextFrameTimeout;
    
    // Constants: default animation properties
    // for out-of-sequence transitions
    var DEFAULT_DURATION_MS = 500;
    var DEFAULT_ZOOM_PERCENT = -10;
    var DEFAULT_PROFILE = "linear";
    
    // The source frame index for the current transition
    var sourceFrameIndex = 0;
    
    // The index of the visible frame
    exports.currentFrameIndex = 0;
    
    // The state of the presentation.
    // If false, no automatic transition will be fired.
    var playing = false;
    
    // The state of the current frame.
    // If true, an automatic transition will be fired after the current timeout.
    var waiting = false;

    /*
     * Starts waiting before moving to the next frame.
     *
     * It the current frame has a timeout set, this method
     * will register a timer to move to the next frame automatically
     * after the specified time.
     *
     * If the current frame is the last, the presentation will
     * move to the first frame.
     */
    function waitTimeout() {
        if (context.sozi.document.frames[exports.currentFrameIndex].timeoutEnable) {
            waiting = true;
            var index = (exports.currentFrameIndex + 1) % context.sozi.document.frames.length;
            nextFrameTimeout = 
                context.setTimeout(
                    function () {
                        exports.moveToFrame(index);
                    },
                context.sozi.document.frames[exports.currentFrameIndex].timeoutMs
            );
        }
    }

    /*
     * Starts the presentation from the given frame index (0-based).
     *
     * This method sets the "playing" flag, shows the desired frame
     * and calls waitTimeout.
     */
    exports.startFromIndex = function (index) {
        playing = true;
        waiting = false;
        sourceFrameIndex = index;
        exports.currentFrameIndex = index;
        viewPort.showFrame(context.sozi.document.frames[index]);
        waitTimeout();
    };

    exports.restart = function () {
        exports.startFromIndex(exports.currentFrameIndex);
    };

    /*
     * Stops the presentation.
     *
     * This method clears the "playing".
     * If the presentation was in "waiting" mode due to a timeout
     * in the current frame, then it stops waiting.
     * The current animation is stopped in its current state.
     */
    exports.stop = function () {
        animator.stop();
        if (waiting) {
            context.clearTimeout(nextFrameTimeout);
            waiting = false;
        }
        playing = false;
        sourceFrameIndex = exports.currentFrameIndex;
    };

    function getZoomData(zoomPercent, s0, s1) {
        var result = {
            ss: ((zoomPercent < 0) ? Math.max(s0, s1) : Math.min(s0, s1)) * (100 - zoomPercent) / 100,
            ts: 0.5,
            k: 0
        };

        if (zoomPercent !== 0) {
            var a = s0 - s1;
            var b = s0 - result.ss;
            var c = s1 - result.ss;

            if (a !== 0) {
                var d = Math.sqrt(b * c);

                var u = (b - d) / a;
                var v = (b + d) / a;

                result.ts = (u > 0 && u <= 1) ? u : v;
            }

            result.k = b / result.ts / result.ts;
        }

        return result;
    }

    /*
     * Jump to a frame with the given index (0-based).
     *
     * This method does not animate the transition from the current
     * state of the display to the desired frame.
     *
     * The presentation is stopped: if a timeout has been set for the
     * target frame, it will be ignored.
     *
     * The URL hash is set to the given frame index (1-based).
     */
    exports.jumpToFrame = function (index) {
        exports.stop();
        context.sozi.events.fire("sozi.player.cleanup");

        sourceFrameIndex = index;
        exports.currentFrameIndex = index;
        viewPort.showFrame(context.sozi.document.frames[index]);

        context.sozi.events.fire("sozi.player.framechange", index);
    };

    /*
     * Returns an associative array where keys are layer names
     * and values are objects in the form { initialState: finalState: profile: zoomWidth: zoomHeight:}
     */
    exports.getAnimationData = function (initialState, finalState, zoomPercent, profile, useTransitionPath, reverseTransitionPath) {
        var data = {};
        
        for (var idLayer in initialState) {
            data[idLayer] = {
                initialState: context.sozi.display.CameraState.instance(),
                finalState: context.sozi.display.CameraState.instance(),
                useTransitionPath: useTransitionPath,
                reverseTransitionPath: reverseTransitionPath
            };
            
            data[idLayer].profile = profile || finalState[idLayer].transitionProfile;
            data[idLayer].initialState.setAtState(initialState[idLayer]);

            // If the current layer is referenced in final state, copy the final properties
            // else, copy initial state to final state for the current layer.
            if (finalState.hasOwnProperty(idLayer)) {
                data[idLayer].finalState.setAtState(finalState[idLayer]);
            }
            else {
                data[idLayer].finalState.setAtState(initialState[idLayer]);
            }

            // Keep the smallest angle difference between initial state and final state
            // TODO this should be handled in the interpolation function
            if (data[idLayer].finalState.angle - data[idLayer].initialState.angle > 180) {
                data[idLayer].finalState.setRawAngle(data[idLayer].finalState.angle - 360);
            }
            else if (data[idLayer].finalState.angle - data[idLayer].initialState.angle < -180) {
                data[idLayer].initialState.setRawAngle(data[idLayer].initialState.angle - 360);
            }

            var zp = zoomPercent || finalState[idLayer].transitionZoomPercent;
            
            if (zp && finalState.hasOwnProperty(idLayer)) {
                data[idLayer].zoomWidth = getZoomData(zp,
                        initialState[idLayer].width,
                        finalState[idLayer].width);
                data[idLayer].zoomHeight = getZoomData(zp,
                        initialState[idLayer].height,
                        finalState[idLayer].height);
            }
        }
        return data;
    };
    
    exports.previewFrame = function (index) {
        exports.currentFrameIndex = index;
        animator.start(DEFAULT_DURATION_MS,
            exports.getAnimationData(viewPort.cameras, context.sozi.document.frames[index].states,
                DEFAULT_ZOOM_PERCENT, context.sozi.animation.profiles[DEFAULT_PROFILE]),
                false, false);
        context.sozi.events.fire("sozi.player.framechange", index);
    };

    /*
     * Moves to a frame with the given index (0-based).
     *
     * This method animates the transition from the current
     * state of the display to the desired frame.
     *
     * If the given frame index corresponds to the next frame in the list,
     * the transition properties of the next frame are used.
     * Otherwise, default transition properties are used.
     */
    exports.moveToFrame = function (index) {
        if (waiting) {
            context.clearTimeout(nextFrameTimeout);
            waiting = false;
        }

        var durationMs, zoomPercent, profile, useTransitionPath, reverseTransitionPath;
        if (index === (exports.currentFrameIndex - 1) % context.sozi.document.frames.length) {
            durationMs = context.sozi.document.frames[exports.currentFrameIndex].transitionDurationMs;
            zoomPercent = undefined; // Set for each layer
            profile = undefined; // Set for each layer
            useTransitionPath = true;
            reverseTransitionPath = true;
        }
        else if (index === (exports.currentFrameIndex + 1) % context.sozi.document.frames.length) {
            durationMs = context.sozi.document.frames[index].transitionDurationMs;
            zoomPercent = undefined; // Set for each layer
            profile = undefined; // Set for each layer
            useTransitionPath = true;
            reverseTransitionPath = false;
        }
        else {
            durationMs = DEFAULT_DURATION_MS;
            zoomPercent = DEFAULT_ZOOM_PERCENT;
            profile = context.sozi.animation.profiles[DEFAULT_PROFILE];
            useTransitionPath = false;
            reverseTransitionPath = false;
        }

        context.sozi.events.fire("sozi.player.cleanup");

        playing = true;
        exports.currentFrameIndex = index;

        animator.start(durationMs, exports.getAnimationData(
            viewPort.cameras, context.sozi.document.frames[index].states,
            zoomPercent, profile,
            useTransitionPath, reverseTransitionPath));

        context.sozi.events.fire("sozi.player.framechange", index);
    };

    /**
     * Jumps to the first frame of the presentation.
     */
    exports.jumpToFirst = function () {
        exports.jumpToFrame(0);
    };
    
    /**
     * Moves to the first frame of the presentation.
     */
    exports.moveToFirst = function () {
        exports.moveToFrame(0);
    };

    /**
     * Jumps to the previous frame.
     */
    exports.jumpToPrevious = function () {
        var index = exports.currentFrameIndex;
        if (!animator.started || sourceFrameIndex <= exports.currentFrameIndex) {
            index -= 1;
        }
        if (index >= 0) {
            exports.jumpToFrame(index);
        }
    };

    /*
     * Moves to the previous frame.
     */
    exports.moveToPrevious = function () {
        for (var index = exports.currentFrameIndex - 1; index >= 0; index -= 1) {
            var frame = context.sozi.document.frames[index];
            if (!frame.timeoutEnable || frame.timeoutMs !== 0) {
                exports.moveToFrame(index);
                break;
            }
        }
    };

    /**
     * Jumps to the next frame.
     */
    exports.jumpToNext = function () {
        var index = exports.currentFrameIndex;
        if (!animator.started || sourceFrameIndex >= exports.currentFrameIndex) {
            index += 1;
        }
        if (index < context.sozi.document.frames.length) {
            exports.jumpToFrame(index);
        }
    };

    /**
     * Moves to the next frame.
     */
    exports.moveToNext = function () {
        if (exports.currentFrameIndex < context.sozi.document.frames.length - 1 || context.sozi.document.frames[exports.currentFrameIndex].timeoutEnable) {
            exports.moveToFrame((exports.currentFrameIndex + 1) % context.sozi.document.frames.length);
        }
    };

    /**
     * Jumps to the last frame of the presentation.
     */
    exports.jumpToLast = function () {
        exports.jumpToFrame(context.sozi.document.frames.length - 1);
    };

    /**
     * Moves to the last frame of the presentation.
     */
    exports.moveToLast = function () {
        exports.moveToFrame(context.sozi.document.frames.length - 1);
    };

    /*
     * Restores the current frame.
     *
     * This method restores the display to fit the current frame,
     * e.g. after the display has been zoomed or dragged.
     */
    exports.moveToCurrent = function () {
        exports.moveToFrame(exports.currentFrameIndex);
    };

    /*
     * Shows all the document in the browser context.
     */
    exports.showAll = function () {
        exports.stop();
        context.sozi.events.fire("sozi.player.cleanup");
        animator.start(DEFAULT_DURATION_MS,
            exports.getAnimationData(viewPort.cameras, viewPort.getDocumentState(),
                DEFAULT_ZOOM_PERCENT, context.sozi.animation.profiles[DEFAULT_PROFILE],
                false, false
            )
        );
    };

    /*
     * Event handler: display ready.
     */
    function onDisplayReady() {
        viewPort = context.sozi.display.ViewPort.instance("player", context.sozi.document.idLayerList, true);
        
        exports.startFromIndex(context.sozi.location.getFrameIndex());

        // Hack to fix the blank screen bug in Chrome/Chromium
        // See https://github.com/senshu/Sozi/issues/109
        context.setTimeout(viewPort.bind(viewPort.update), 1);
        
        context.sozi.events.fire("sozi.player.ready");
    }

    // TODO move the zoom code to display.js
    exports.onAnimationStep = function (progress, data) {
        for (var idLayer in data) {
            var camera = viewPort.cameras[idLayer];
            
            camera.interpolate(
                data[idLayer].initialState,
                data[idLayer].finalState,
                data[idLayer].profile(progress),
                data[idLayer].useTransitionPath,
                data[idLayer].reverseTransitionPath
            );

            var ps;
            if (data[idLayer].zoomWidth && data[idLayer].zoomWidth.k !== 0) {
                    ps = progress - data[idLayer].zoomWidth.ts;
                    camera.width = data[idLayer].zoomWidth.k * ps * ps + data[idLayer].zoomWidth.ss;
            }

            if (data[idLayer].zoomHeight && data[idLayer].zoomHeight.k !== 0) {
                    ps = progress - data[idLayer].zoomHeight.ts;
                    camera.height = data[idLayer].zoomHeight.k * ps * ps + data[idLayer].zoomHeight.ss;
            }

            camera.setClipped(data[idLayer].finalState.clipped);
        }

        viewPort.update();
    };
    
    /**
     * @depend animation.js
     */
    animator = context.sozi.animation.Animator.instance().augment({
            /*
             * Event handler: animation step.
             *
             * This method is called periodically by animator after the animation
             * has been started, and until the animation time is elapsed.
             *
             * Parameter data provides the following information:
             *    - initialState and finalState contain the geometrical properties of the display
             *      at the start and end of the animation.
             *    - profile is a reference to the speed profile function to use.
             *    - zoomWidth and zoomHeight are the parameters of the zooming polynomial if the current
             *      animation has a non-zero zooming effect.
             *
             * Parameter progress is a float number between 0 (start of the animation)
             * and 1 (end of the animation).
             */
            onStep: function (progress) {
                exports.onAnimationStep(progress, this.data);
            },
            
            /*
             * Event handler: animation done.
             *
             * This method is called by animator when the current animation is finished.
             *
             * If the animation was a transition in the normal course of the presentation,
             * then we call the waitTimeout method to process the timeout property of the current frame.
             */
            onDone: function () {
                for (var idLayer in this.data) {
                    viewPort.cameras[idLayer].setAtState(this.data[idLayer].finalState);
                }

                viewPort.update();

                sourceFrameIndex = exports.currentFrameIndex;

                if (playing) {
                    waitTimeout();
                }
            }
    });

    context.sozi.events.listen("sozi.display.ready", onDisplayReady); // @depend events.js
});
