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
 * @name sozi.animation
 * @namespace A general-purpose animation controller.
 * @depend namespace.js
 */
namespace(this, "sozi.animation", function (exports, window) {
    /** @lends sozi.animation */
    
    "use strict";
    
    /**
     * The browser-specific function to request an animation frame.
     *
     * @function
     */
    var requestAnimationFrame =
            context.mozRequestAnimationFrame ||
            context.webkitRequestAnimationFrame ||
            context.msRequestAnimationFrame ||
            context.oRequestAnimationFrame;

    var getCurrentTime = function () {
        return context.performance && context.performance.now ?
            context.performance.now() :
            Date.now();
    };

    exports.setAnimationFrameHandlers = function (requestAnimationFrameFunction, getCurrentTimeFunction) {
        requestAnimationFrame = requestAnimationFrameFunction;
        getCurrentTime = getCurrentTimeFunction;
    };

    /**
     * The default time step.
     *
     * <p>For browsers that do not support animation frames.</p>
     *
     * @constant
     * @type Number
     */
    var TIME_STEP_MS = 40;
    
    /**
     * The handle provided by <code>setInterval()</code>.
     *
     * <p>For browsers that do not support animation frames.</p>
     */
    var timer;
    
    /**
     * The list of running animators.
     *
     * @type Array
     */
    var animatorList = [];
    
    /**
     * The main animation loop.
     *
     * <p>This function is called periodically and triggers the
     * animation steps in all running animators.</p>
     *
     * <p>If all animators are removed from the list of running animators,
     * then the periodic calling is disabled.</p>
     *
     * <p>This function can be called either through {@link sozi.animation-requestAnimationFrame}
     * if the browser supports it, or through <code>setInterval()</code>.</p>
     */
    function loop() {
        if (animatorList.length > 0) {
            // If there is at least one animator,
            // and if the browser provides animation frames,
            // schedule this function to be called again in the next frame.
            if (requestAnimationFrame) {
                requestAnimationFrame(loop);
            }

            // Step all animators
            animatorList.forEach(function (animator) {
                // TODO use timestamp argument:
                // browser compatibility issue with Date.now()
                // and performance.now() timestamps.
                animator.step(getCurrentTime());
            });
        }
        else {
            // If all animators have been removed,
            // and if this function is called periodically
            // through setInterval, disable the periodic calling.
            if (!requestAnimationFrame) {
                context.clearInterval(timer);
            }
        }
    }
    
    /**
     * Start the animation loop.
     *
     * <p>This function delegates the periodic update of all animators
     * to the {@link sozi.animation-loop} function, either through {@link sozi.animation-requestAnimationFrame}
     * if the browser supports it, or through <code>setInterval()</code>.</p>
     */
    function start() {
        if (requestAnimationFrame) {
            requestAnimationFrame(loop);
        }
        else {
            timer = context.setInterval(function () {
                loop(getCurrentTime());
            }, TIME_STEP_MS);
        }
    }
    
    /**
     * Add a new animator object to the list of running animators.
     *
     * <p>If the animator list was empty before calling this function,
     * then the animation loop is started.</p>
     *
     * @param {context.sozi.animation.Animator} animator The animator object to add.
     */
    function addAnimator(animator) {
        animatorList.push(animator);
        if (animatorList.length === 1) {
            start();
        }
    }
    
    /**
     * Remove the given animator from the list of running animators.
     *
     * @param {context.sozi.animation.Animator} animator The animator object to add.
     */
    function removeAnimator(animator) {
        animatorList.splice(animatorList.indexOf(animator), 1);
    }
    
    /**
     * @class
     *
     * An animator provides the logic for animating other objects.
     *
     * <p>The main purpose of an animator is to schedule the update
     * operations in the animated objects.</p>
     *
     * @memberOf context.sozi.animation
     * @name Animator
     * @depend proto.js
     */
    exports.Animator = context.sozi.proto.Object.subtype({
        /** @lends sozi.animation.Animator */
        
        /**
         * Construct a new animator.
         */
        construct: function () {
            /**
             * The animation duration, in milliseconds.
             * @type Number
             */
            this.durationMs = 0;
            
            /**
             * A "payload" object that can be used by {@link sozi.animation.Animator.onStep}
             * and {@link sozi.animation.Animator.onDone}.
             */
            this.data = null;
            
            /**
             * The start time of the animation.
             * @type Number
             */
            this.initialTime = 0;
            
            /**
             * The current state of this animator.
             * @type Boolean
             */
            this.started = false;
        },

        /**
         * Start the current animator.
         *
         * <p>The current animator is added to the list of running animators
         * and is put in the "started" state.
         * It will be removed from the list automatically when the given duration
         * has elapsed.</p>
         *
         * <p>Method {@link sozi.animation.Animator.onStep} is called once before starting the animation.</p>
         *
         * @param {Number} durationMs The animation duration, in milliseconds
         * @param data Some data that can be used in {@link sozi.animation.Animator.onStep}
         * and {@link sozi.animation.Animator.onDone}
         */
        start: function (durationMs, data) {
            this.durationMs = durationMs;
            this.data = data;
            this.initialTime = getCurrentTime();
            this.onStep(0);
            if (!this.started) {
                this.started = true;
                addAnimator(this);
            }
        },

        /**
         * Stop the current animator.
         *
         * <p>The current animator is removed from the list of running animators
         * and is put in the "stopped" state.</p>
         */
        stop: function () {
            if (this.started) {
                removeAnimator(this);
                this.started = false;
            }
        },

        /**
         * Perform one animation step.
         *
         * <p>This function is called automatically by the {@link sozi.animation-loop} function.
         * It calls {@link sozi.animation.Animator.onStep}.
         * If the animation duration has elapsed, {@link sozi.animation.Animator.onDone} is called.</p>
         *
         * @param {Number} currentTime The current time
         */
        step: function (currentTime) {
            var elapsedTime = currentTime - this.initialTime;
            if (elapsedTime >= this.durationMs) {
                this.stop();
                this.onStep(1);
                this.onDone();
            } else {
                this.onStep(elapsedTime / this.durationMs);
            }
        },
        
        /**
         * This method is called automatically on each animation step.
         *
         * <p>The default implementation does nothing. Override it in a
         * subclass or instance to provide your own implementation.<p>
         *
         * @param {Number} progress The elapsed fraction of the total duration (comprised between 0 and 1 included).
         */
        onStep: function (progress) {
            // Do nothing
        },
        
        /**
         * This method is called automatically when the animation ends.
         *
         * <p>The default implementation does nothing. Override it in a
         * subclass or instance to provide your own implementation.<p>
         */
        onDone: function () {
            // Do nothing
        }
    });

    /*
     * The acceleration profiles.
     *
     * Each profile is a function that operates in the interval [0, 1]
     * and produces a result in the same interval.
     *
     * These functions are meant to be called in {@link sozi.animation.Animator.onStep}
     * to transform the progress indicator according to the desired
     * acceleration effect.
     */
    exports.profiles = {
        "linear": function (x) {
            return x;
        },

        "accelerate": function (x) {
            return Math.pow(x, 3);
        },

        "strong-accelerate": function (x) {
            return Math.pow(x, 5);
        },

        "decelerate": function (x) {
            return 1 - Math.pow(1 - x, 3);
        },

        "strong-decelerate": function (x) {
            return 1 - Math.pow(1 - x, 5);
        },

        "accelerate-decelerate": function (x) {
            var xs = x <= 0.5 ? x : 1 - x,
                y = Math.pow(2 * xs, 3) / 2;
            return x <= 0.5 ? y : 1 - y;
        },

        "strong-accelerate-decelerate": function (x) {
            var xs = x <= 0.5 ? x : 1 - x,
                y = Math.pow(2 * xs, 5) / 2;
            return x <= 0.5 ? y : 1 - y;
        },

        "decelerate-accelerate": function (x) {
            var xs = x <= 0.5 ? x : 1 - x,
                y = (1 - Math.pow(1 - 2 * xs, 2)) / 2;
            return x <= 0.5 ? y : 1 - y;
        },

        "strong-decelerate-accelerate": function (x) {
            var xs = x <= 0.5 ? x : 1 - x,
                y = (1 - Math.pow(1 - 2 * xs, 3)) / 2;
            return x <= 0.5 ? y : 1 - y;
        },
        
        "immediate-beginning": function (x) {
            return 1;
        },
        
        "immediate-end": function (x) {
            return x === 1 ? 1 : 0;
        },
        
        "immediate-middle": function (x) {
            return x >= 0.5 ? 1 : 0;
        }
    };
});

