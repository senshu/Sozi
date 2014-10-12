/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

namespace("sozi.editor.backend", function (exports) {
    "use strict";

    exports.list = [];
    
    exports.add = function (backend) {
        exports.list.push(backend);
    };
    
    exports.AbstractBackend = sozi.model.Object.clone({
        
        init: function (container, html) {
            container.html(html);
            return this;
        },

        /*
         * Return the base name of the file
         * represented by the given descriptor.
         * 
         * Parameters:
         *  - fileDescriptor (backend-dependent)
         * 
         * Returns:
         *  - The file name (string)
         */
        getName: function (fileDescriptor) {
            // Not implemented
            return "";
        },
        
        /*
         * Return the location of the file
         * represented by the given descriptor.
         * 
         * Parameters:
         *  - fileDescriptor (backend-dependent)
         * 
         * Returns:
         *  - The file location (backend-dependent)
         */
        getLocation: function (fileDescriptor) {
            // Not implemented
            return null;
        },
        
        /*
         * Find a file.
         * 
         * Parameters
         *  - name (string) The base name of the file
         *  - location (backend-dependent)
         *  - callback (function) The function to call when the operation completes
         * 
         * The callback function accepts the following parameters:
         *  - fileDescriptor (backend-dependent), null if no file was found
         */
        find: function (name, location, callback) {
            // Not implemented
            callback(null);
        },
        
        /*
         * Load a file.
         *
         * This method loads a file and fires the "load" event. This event
         * must be fired even if loading failed.
         * 
         * If the file was successfully loaded and if the backend supports it,
         * a "change" event can be fired when the file is modified after being
         * loaded. The "change" event must be fired only on the first modification
         * after the file has been loaded.
         * 
         * Parameters
         *  - fileDescriptor (backend-dependent)
         * 
         * Events
         *  - load(fileDescriptor, data, err)
         *  - change(fileDescriptor)
         */
        load: function (fileDescriptor) {
            // Not implemented
            this.fire("load", fileDescriptor, "", "Not implemented");
        },

        /*
         * Create a new file.
         * 
         * Parameters:
         *  - name (string)
         *  - location (backend-dependent)
         *  - mimeType (string)
         *  - data (string)
         *  - callback (function) The function to call when the operation completes
         * 
         * The callback function accepts the following parameters:
         *  - fileDescriptor (backend-dependent)
         *  - err (string)
         */
        create: function (name, location, mimeType, data, callback) {
            // Not implemented
            callback(null, "Not implemented");
        },
        
        /*
         * Save data to an existing file.
         * 
         * Parameters:
         *  - fileDescriptor (backend-dependent)
         *  - data (string)
         * 
         * Events:
         *  - save(fileDescriptor, err)
         * 
         * TODO use a callback instead of an event
         */
        save: function (fileDescriptor, data) {
            // Not implemented
            this.fire("save", fileDescriptor, "Not implemented");
        },

        /*
         * Start autosaving the given file.
         *
         * Typically, we want to save each time the editor loses focus
         * and when the editor closes.
         *
         * Parameters:
         *  - fileDescriptor (backend-dependent)
         *  - getData (function) A function that returns the data to save.
         */
        autosave: function (fileDescriptor, getData) {
            var self = this;
            $(window).blur(function () {
                self.save(fileDescriptor, getData());
            });
        }
    });
});
