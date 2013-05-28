/*
 * jQuery imagescroll v0.4
 * http://makealone.jp/products/jquery.imagescroll/
 *
 * Copyright 2013, makealone.jp
 * Free to use and abuse under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 */

(function($) {
    $.fn.imagescroll = function(options) {
        var undefined;

        // options
        //
        // image_src -- load image path
        // resize -- function of resize
        // load -- function of loaded
        // zoom_reset -- id for zoom reset button
        // zoom_in -- id for zoom in button
        // zoom_out -- id for zoom out button
        //
        var defaults = {color: '#000000',
                        image_src: '',
                        load: (function() {}),
                        auto_resize: true,
                        resize: (function() {}),
                        zoom_reset: '',
                        zoom_in: '',
                        zoom_out: ''
                       };

        // settings
        var interval_time = 1000 / 60;
        var friction = 0.08;
        var flick_time = 500;
        var flick_dist = 40;
        var double_time = 500;
        var zoom_speed = 0.02;

        // environment
        var isTouchSupported = 'ontouchstart' in window;
        var dpr = window.devicePixelRatio;  // dot per pixel
        if (dpr == undefined) {
            dpr = 1;
        }
        var _requestAnimFrame = (function(){
            return window.requestAnimationFrame    ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                window.oRequestAnimationFrame      ||
                window.msRequestAnimationFrame     ||
                function(callback) {
                    window.setTimeout(callback, interval_time);
                };
        })();

        // define
        var HIT_LEFT = 1;
        var HIT_RIGHT = 2;
        var HIT_TOP = 4;
        var HIT_BOTTOM = 8;

        // contains all method
        var methods = {
            create: function() {

                return this.each(function(i) {
                    var $this = $(this);

                    var opts = $.extend(defaults, options);

                    // view port
                    var vp_width = $this.width();
                    var vp_height = $this.height();
                    var scope_width = vp_width * dpr;
                    var scope_height = vp_height * dpr;
                    var scope_zoom = 0.5;

                    // Image
                    var image_loaded = false;

                    // Image anchor
                    var xpos = 0;
                    var ypos = 0;
                    // Image anchor position
                    var xoffset = scope_width / 2;
                    var yoffset = scope_height / 2;

                    // move speed(/ms)
                    var velocityx = 0;
                    var velocityy = 0;
                    var velocityz = 0;
                    // zoom max/min
                    var zoom_min = 0.25;
                    var zoom_max = 1;

                    // touch status
                    var touch_x = -1;
                    var touch_y = -1;
                    var touch_x_init = -1;
                    var touch_y_init = -1;
                    var touch_time = 0;
                    var click_time = 0;
                    var double_flag = false;

                    // create canvas
                    var theCanvas = document.createElement("canvas");
                    var context = theCanvas.getContext('2d');

                    function setSize(width, height) {
                        vp_width = width;
                        vp_height = height;
                        scope_width = vp_width * dpr;
                        scope_height = vp_height * dpr;
                        theCanvas.setAttribute('width', scope_width);
                        theCanvas.setAttribute('height', scope_height);
                        $(theCanvas).width(vp_width);
                        $(theCanvas).height(vp_height);
                    }

                    function shiftImage(x, y) {
                        var img_pos = conv_image_position(x, y);
                        xoffset = x;
                        yoffset = y;
                        xpos = img_pos.x;
                        ypos = img_pos.y;
                    }

                    function adjustImage(x, y) {
                        var img_pos = conv_image_position(x, y);
                        xpos = img_pos.x;
                        ypos = img_pos.y;
                        xoffset = x;
                        yoffset = y;
                    }

                    function setImage() {
                        // image positioning
                        xoffset = scope_width / 2;
                        yoffset = scope_height / 2;
                        xpos = image_map.width / 2;
                        ypos = image_map.height / 2;

                        // calc zoom max/min
                        var image_rate = image_map.width * 1.0 / image_map.height;
                        var scope_rate = scope_width * 1.0 / scope_height;
                        if (image_rate > scope_rate) {
                            scope_zoom = scope_height / image_map.height ;
                        } else {
                            scope_zoom = scope_width / image_map.width;
                        }
                        zoom_min = scope_zoom;
                        zoom_max = Math.max(zoom_min, 4);
                    }

                    function calc_sx() {
                        return Math.min(
                            Math.max(xpos - (xoffset / scope_zoom), 0),
                            image_map.width - (scope_width / scope_zoom)
                        );
                    }

                    function calc_sy() {
                        return Math.min(
                            Math.max(ypos - (yoffset / scope_zoom), 0),
                            image_map.height - (scope_height / scope_zoom)
                        );
                    }

                    function calc_width() {
                        return Math.min(scope_width / scope_zoom,
                                        image_map.width);
                    }

                    function calc_height() {
                        return Math.min(scope_height / scope_zoom,
                                        image_map.height);
                    }

                    function conv_element_position(px, py) {
                        // convert page position to element position
                        var elem = $(theCanvas);
                        var base_x = elem.offset().left;
                        var base_y = elem.offset().top;
                        return {x: px - base_x, y: py - base_y};
                    }

                    function conv_image_position(sx, sy) {
                        // conver element position to image position
                        var gx = (sx - xoffset) / scope_zoom + xpos;
                        var gy = (sy - yoffset) / scope_zoom + ypos;
                        return {x: gx, y: gy};
                    }

                    function clippos() {
                        var hit = 0;
                        var src_s_dx = xoffset / scope_zoom;
                        var src_s_dy = yoffset / scope_zoom;
                        var src_e_dx = (scope_width - xoffset) / scope_zoom;
                        var src_e_dy = (scope_height - yoffset) / scope_zoom;
                        if (xpos - src_s_dx < 0) {
                            xpos = src_s_dx;
                            hit += HIT_LEFT;
                        }
                        if (xpos + src_e_dx > image_map.width) {
                            xpos = image_map.width - src_e_dx;
                            hit += HIT_RIGHT;
                        }
                        if (ypos - src_s_dy < 0) {
                            ypos = src_s_dy;
                            hit += HIT_TOP;
                        }
                        if (ypos + src_e_dy > image_map.height) {
                            ypos = image_map.height - src_e_dy;
                            hit += HIT_BOTTOM;
                        }
                        return hit;
                    }

                    function posMove() {
                        if (velocityx) {
                            xpos -= velocityx * interval_time;
                        }
                        if (velocityy) {
                            ypos -= velocityy * interval_time;
                        }
                        var hit = clippos();
                        if (velocityx || velocityy) {
                            if (hit & HIT_LEFT || hit & HIT_RIGHT) {
                                velocityx = 0;
                            } else {
                                velocityx = velocityx - (velocityx * friction);
                            }
                            if (hit & HIT_TOP || hit & HIT_BOTTOM) {
                                velocityy = 0;
                            } else {
                                velocityy = velocityy - (velocityy * friction);
                            }
                        }
                    }

                    function zoomMove() {
                        if (velocityz) {
                            scope_zoom += velocityz * interval_time;
                            if (scope_zoom > zoom_max) {
                                scope_zoom = zoom_max;
                                velocityz = 0;
                            }
                            if (scope_zoom < zoom_min) {
                                scope_zoom = zoom_min;
                                velocityz = 0;
                            }
                        }
                        clippos();
                    }

                    function drawScope() {
                        var sx = calc_sx();
                        var sy = calc_sy();
                        var width = calc_width();
                        var height = calc_height();
                        try {
                            context.drawImage(image_map,
                                              sx,
                                              sy,
                                              width,
                                              height,
                                              0, 0, scope_width, scope_height);
                        } catch (exception) {
                            return;
                        }
                    }

                    function getPoint(e) {
                        if (e.type == 'touchmove' || e.type == 'touchstart') {
                            var touch = e.originalEvent.changedTouches[0];
                            return {'x': touch.clientX, 'y': touch.clientY};
                        }
                        if (e.type == 'mousedown' || e.type == 'mousemove') {
                            return {'x': e.pageX, 'y': e.pageY};
                        }
                        return {'x': -1, 'y': -1};
                    }

                    function eventScopeDoubleClick(e) {
                        var pos = conv_element_position(touch_x_init, touch_y_init);
                        shiftImage(pos.x, pos.y);
                        velocityx = 0;
                        velocityy = 0;
                        velocityz = zoom_speed / 2 / interval_time;
                        touch_x = -1;
                        touch_y = -1;
                        touch_time = 0;
                    }

                    function eventScopeClick(e) {
                        velocityz = 0;
                        if (double_flag && ((e.timeStamp - click_time) < double_time)) {
                            // double click
                            double_flag = false;
                            click_time = 0;
                            eventScopeDoubleClick(e);
                        } else {
                            // click
                            double_flag = true;
                            click_time = e.timeStamp;
                        }
                    }

                    function eventIgnore(e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }

                    function eventScope(e) {
                        e.preventDefault();
                        e.stopPropagation();

                        switch (e.type) {
                        case 'touchstart':
                        case 'mousedown':
                            if (touch_x >= 0) {
                                return;
                            }
                            adjustImage(scope_width / 2, scope_height / 2);
                            (function() {
                                var point = getPoint(e);
                                touch_x = point['x'];
                                touch_y = point['y'];
                                touch_x_init = touch_x;
                                touch_y_init = touch_y;
                                touch_time = e.timeStamp;
                                velocityx = 0;
                                velocityy = 0;
                                velocityz = 0;
                            })();
                            break;
                        case 'touchmove':
                        case 'mousemove':
                            if (touch_x < 0) {
                                return;
                            }
                            (function() {
                                velocityx = 0;
                                velocityy = 0;
                                velocityz = 0;
                                var point = getPoint(e);
                                var dx = point['x'] - touch_x;
                                var dy = point['y'] - touch_y;
                                touch_x = point['x'];
                                touch_y = point['y'];
                                xpos -= dx / scope_zoom;
                                ypos -= dy / scope_zoom;
                                clippos();
                            })();
                            break;
                        case 'touchend':
                        case 'mouseup':
                        case 'mouseout':
                            if (touch_x < 0) {
                                return;
                            }
                            (function (){
                                var dx = touch_x - touch_x_init;
                                var dy = touch_y - touch_y_init;
                                var dist = Math.sqrt(dx * dx + dy * dy);
                                var dt = e.timeStamp - touch_time;
                                if (dt < flick_time && dist > flick_dist) {
                                    // flic
                                    velocityx = dx / dt;
                                    velocityy = dy / dt;
                                    velocityz = 0;
                                } else if (dt < flick_time && dist < flick_dist) {
                                    // click
                                    velocityx = 0;
                                    velocityy = 0;
                                    velocityz = 0;
                                    eventScopeClick(e);
                                } else {
                                    // drag
                                    velocityx = 0;
                                    velocityy = 0;
                                    velocityz = 0;
                                }
                                touch_x = -1;
                                touch_y = -1;
                                touch_time = 0;
                            })();
                            break;
                        }
                    }

                    function eventZoomReset(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.type == 'touchend' || e.type == 'mouseup' || e.type == 'mouseout') {
                            adjustImage(scope_width / 2, scope_height / 2);
                            scope_zoom = Math.max(zoom_min, 1.0);
                            velocityz = 0;
                        }
                    }

                    function eventZoomIn(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.type == 'touchstart' || e.type == 'mousedown') {
                            adjustImage(scope_width / 2, scope_height / 2);
                            velocityz = zoom_speed / interval_time;
                        }
                        if (e.type == 'touchend' || e.type == 'mouseup' || e.type == 'mouseout') {
                            velocityz = 0;
                        }
                    }

                    function eventZoomOut(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.type == 'touchstart' || e.type == 'mousedown') {
                            adjustImage(scope_width / 2, scope_height / 2);
                            velocityz = -1 * zoom_speed / interval_time;
                        }
                        if (e.type == 'touchend' || e.type == 'mouseup' || e.type == 'mouseout') {
                            velocityz = 0;
                        }
                    };

                    function render() {
                        posMove();
                        zoomMove();
                        drawScope();
                    }

                    function eventImageLoaded() {
                        image_loaded = true;
                        setImage();

                        // event setting
                        var view = $(theCanvas);
                        if (isTouchSupported) {
                            view.bind('touchstart', eventScope);
                            view.bind('touchmove', eventScope);
                            view.bind('touchend', eventScope);
                            view.bind('click', eventIgnore);
                            view.bind('dblclick', eventIgnore);

                        } else {
                            view.bind('mousedown', eventScope);
                            view.bind('mousemove', eventScope);
                            view.bind('mouseout', eventScope);
                            view.bind('mouseup', eventScope);
                            view.bind('click', eventIgnore);
                            view.bind('dblclick', eventIgnore);
                        }
                        if (opts.zoom_reset) {
                            var zoomReset = $('#' + opts.zoom_reset);
                            if (isTouchSupported) {
                                zoomReset.bind('touchend', eventZoomReset);
                            } else {
                                zoomReset.bind('mouseup', eventZoomReset);
                            }
                        }
                        if (opts.zoom_in) {
                            var zoomIn = $('#' + opts.zoom_in);
                            if (isTouchSupported) {
                                zoomIn.bind('touchstart', eventZoomIn);
                                zoomIn.bind('touchend', eventZoomIn);
                                zoomIn.bind('click', eventIgnore);
                            } else {
                                zoomIn.bind('mousedown', eventZoomIn);
                                zoomIn.bind('mouseup', eventZoomIn);
                                zoomIn.bind('mouseout', eventZoomIn);
                                zoomIn.bind('click', eventIgnore);
                            }
                        }
                        if (opts.zoom_out) {
                            var zoomOut = $('#' + opts.zoom_out);
                            if (isTouchSupported) {
                                zoomOut.bind('touchstart', eventZoomOut);
                                zoomOut.bind('touchend', eventZoomOut);
                                zoomOut.bind('click', eventIgnore);
                            } else {
                                zoomOut.bind('mousedown', eventZoomOut);
                                zoomOut.bind('mouseup', eventZoomOut);
                                zoomOut.bind('mouseout', eventZoomOut);
                                zoomOut.bind('click', eventIgnore);
                            }
                        }

                        (function animloop(){
                            render();
                            _requestAnimFrame(animloop);
                        })();

                        render();
                        opts.load();  // callback
                    }

                    function eventMinimum() {
                        setSize(1, 1);
                    }

                    function eventMaximum() {
                        setSize($this.width(), $this.height());
                        if (image_loaded) {
                            setImage();
                            render();
                        }
                    }

                    function eventResize() {
                        eventMinimum();
                        opts.resize();  // callback
                        eventMaximum();
                    }

                    setSize($this.width(), $this.height());
                    context.fillStyle = opts.color;
                    context.fillRect(0, 0, scope_width, scope_height);
                    $this.append(theCanvas);

                    var image_map = new Image();
                    image_map.src = opts.image_src;
                    image_map.addEventListener('load', eventImageLoaded, false);

                    $this.bind('minimun', eventMinimum);
                    $this.bind('maximum', eventMaximum);

                    if (opts.auto_resize) {
                        $(window).bind('resize', eventResize);
                        $(window).bind('orientationchange', eventResize);
                    }

                    return this;
                });
            },
            minimum: function() {
                $(this).trigger('minimum');
            },
            maximum: function() {
                $(this).trigger('maximum');
            }
        };

        if (options == 'minimum') {
            return methods.minimum.apply(this);
        } else if (options == 'maximum') {
            return methods.maximum.apply(this);
        } else {
            return methods.create.apply(this);
        }
    };

})(jQuery);
