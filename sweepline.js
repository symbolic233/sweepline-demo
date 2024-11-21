/**
 * Sweepline - Yoseph Mak
 * Demonstration of the sweepline algorithm on an HTML webpage.
 * I guess this code is by default public.
 * However, if you want to use it for some reason, then do keep in mind that it is in JavaScript, everyone's favorite language.
 * This may make translating it into a programming language difficult.
 */

// ----- constants -----

// canvas info
var canvas
var ctx
var origin_x = 25 // px
var origin_y = 25 // px

// This is the bounds (in coordinate system language) for where points for the lines exist.
var x_max = 75
var x_spacing = 5
var y_max = 30
var y_spacing = 5

var x_tick_px = 50
var y_tick_px = 50

var horizontal = 20; // min horizontal distance between points

// The actual lines.
var lines = []
var num_lines = 1

// Sweepline use
var segment_list = []
var event_queue = []
var intersections = []
var labels = "abcdefghijklmnopqrstvuwxyz" // the best labels there ever were
var current_x = -100

var intersections_bf = [] // brute-force intersections

// ----- useful functions -----

function gcd(a, b) {
    if (b == 0) return Math.abs(a);
    a = Math.abs(a);
    b = Math.abs(b);
    while (b != 0) {
        var r = a % b
        a = b
        b = r
    }
    return a
}

/**
 * Return 0 <= i <= array.length such that !pred(array[i - 1]) && pred(array[i]).
 * https://stackoverflow.com/questions/22697936/binary-search-in-javascript
 */
function binarySearch(array, pred) {
    let lo = -1, hi = array.length;
    while (1 + lo < hi) {
        var mi = lo + ((hi - lo) >> 1);
        if (pred(array[mi])) {
            hi = mi;
        } else {
            lo = mi;
        }
    }
    return hi;
}

// comparator: comp(a, b) => a < b (basically)
function insert_into(arr, comp, e) {
    var i = binarySearch(arr, x => comp(e, x))
    arr.splice(i, 0, e)
}

// ----- line generation -----

function new_point() {
    // generate x/y coordinates from 1 to their max values
    var x = Math.floor(Math.random() * x_max) + 1
    var y = Math.floor(Math.random() * y_max) + 1
    return [x, y]
}

// the above, but avoid picking a close x-coordinate
// I initially just regenerated points arbitrarily, but that is so wasteful.
function new_second_point(x1, x_threshold) {
    // generate x/y coordinates from 1 to their max values
    if (x1 < x_threshold) {
        // [x1 + x_threshold, x_max]
        x = Math.floor(Math.random() * (x_max - x1 - x_threshold + 1)) + x1 + x_threshold
    }
    else if (x_max - x1 < x_threshold) {
        // [1, x1 - x_threshold]
        x = Math.floor(Math.random() * (x1 - x_threshold)) + 1
    }
    else {
        // [1, x1 - x_threshold] U [x1 + x_threshold, x_max]
        // The way I do this is by picking from x_max - 2 * x_threshold + 1 choices and adding if needed.
        x = Math.floor(Math.random() * (x_max - 2 * x_threshold + 1))
        x += (x < x1 - x_threshold) ? 1 : (2 * x_threshold)
    }
    y = Math.floor(Math.random() * y_max) + 1
    return [x, y]
}

// Generate n random line segments in the context of the problem.
// The conditions to make this work are that there are no vertical lines, and no endpoint is on another line segment.
// There are probably cool ways of doing this, but I've chosen to cut corners here: any line's dx and dy are relatively prime.
// This is just intended to ensure there are no integer coordinate points inside a line, so only endpoint checks are needed.

// x_threshold can be set indicating the minimum allowed dx, so as to avoid stupidly short/vertical lines for aesthetics.
function generate_lines(n, x_threshold = 1) {
    var endpoints = []
    for (var i = 0; i < n; i++) {
        var [x1, y1] = new_point()
        while ([x1, y1] in endpoints) {
            [x1, y1] = new_point()
        }
        var [x2, y2] = new_second_point(x1, x_threshold)
        while ([x2, y2] in endpoints || Math.abs(x2 - x1) <= x_threshold
            || y1 == y2 || (gcd(x2 - x1, y2 - x1) != 1)) {
            [x2, y2] = new_second_point(x1, x_threshold) // only need to regenerate one of these
        }
        // insert left to right
        if (x1 < x2) endpoints.push([x1, y1], [x2, y2])
        else endpoints.push([x2, y2], [x1, y1])
    }

    // reset lines
    lines = []
    for (var i = 0; i < 2 * n; i += 2) {
        lines.push([endpoints[i], endpoints[i + 1]])
    }

    // sort lines
    lines.sort(compare_lines)
}

function point_to_canvas(x, y) {
    return [origin_x + (x / x_spacing) * x_tick_px,
        origin_y - (y / y_spacing) * (y_tick_px)
    ]
}

// ----- canvas drawing -----

function init_canvas() {
    canvas = document.getElementById("canvas")
    ctx = canvas.getContext("2d")
    origin_y = canvas.height - origin_y
}

function set_canvas_bg() {
    // ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
}

// Resets the draw style as needed.
function draw_line(x1, y1, x2, y2, color = "black", width = 1) {
    var old_fill = ctx.fillStyle
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.fillStyle = old_fill
}

function draw_point(x, y, color = "black", width = 1) {
    var old_fill = ctx.fillStyle
    ctx.beginPath()
    ctx.arc(x, y, width, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
    ctx.fillStyle = old_fill
}

function draw_axes() {
    draw_line(origin_x, 0, origin_x, canvas.height, "black", 4)
    draw_line(0, origin_y, canvas.width, origin_y, "black", 4)
}

// Draw ticks for the above axes where the spacing between x-axis ticks and y-axis ticks are given (in px).
function draw_ticks(x_spacing, y_spacing) {
    for (var i = 0; i < (canvas.width - origin_x) / x_spacing; i++) {
        draw_line(origin_x + i * x_spacing, origin_y - 5, origin_x + i * x_spacing, origin_y + 5, "black", 2)
    }
    for (var j = 0; j < origin_y / y_spacing; j++) {
        draw_line(origin_x - 5, origin_y - j * y_spacing, origin_x + 5, origin_y - j * y_spacing, "black", 2)
    }
}

function reset_grid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    set_canvas_bg()
    draw_axes()
    draw_ticks(x_tick_px, y_tick_px)
}

// Draws all the line segments (ideally).
function draw_segments() {
    for (var i = 0; i < lines.length; i++) {
        var [x1, y1] = point_to_canvas(lines[i][0][0], lines[i][0][1])
        var [x2, y2] = point_to_canvas(lines[i][1][0], lines[i][1][1])
        // console.log(x1, x2, y1, y2)
        draw_line(x1, y1, x2, y2, "gray", 1)
    }
}

// Draws all the (coordinate system) points given by arr.
function draw_intersections(arr, color, width = 1) {
    for (var i = 0; i < arr.length; i++) {
        var [xi, yi] = point_to_canvas(arr[i][0], arr[i][1])
        draw_point(xi, yi, color, width)
    }
}

// Rebuilds the drawing of the canvas demo.
function reconstruct_demo(n) {
    reset_grid()
    generate_lines(n, horizontal)
    draw_segments()
}

// Assumes everything is in place to be drawn.
function redraw_sweepline_grid() {
    reset_grid()
    draw_segments()
    var current_x_px = origin_x + (current_x / x_spacing) * x_tick_px

    draw_intersections(intersections_bf, "blue", 3)
    draw_intersections(intersections, "red", 4)

    // the sweep line
    draw_line(current_x_px, 0, current_x_px, canvas.height, "green", 1)
}

// ----- Sweepline magic ----

// As before, lines are formatted as [[x1, y1], [x2, y2]] because JS has a very good type system.
function slope_intercept(line) {
    var m = (line[1][1] - line[0][1]) / (line[1][0] - line[0][0])
    var b = line[1][1] - m * line[1][0]
    return [m, b]
}

// returns a point [x, y] or null if no intersection
function check_intersection(l1, l2) {
    var [m1, b1] = slope_intercept(l1)
    var [m2, b2] = slope_intercept(l2)
    if (m1 == m2) return null;
    // m1 * x + b1 = m2 * x + b2
    var x = (b1 - b2) / (m2 - m1)
    var x_lb = Math.max(Math.min(l1[0][0], l1[1][0]), Math.min(l2[0][0], l2[1][0]))
    var x_ub = Math.min(Math.max(l1[0][0], l1[1][0]), Math.max(l2[0][0], l2[1][0]))
    if (x <= x_lb || x >= x_ub) return null;
    return [x, m1 * x + b1]
}

// Check all intersections in the input set of lines by brute-force.
function check_intersections_bf() {
    for (var i = 0; i < lines.length; i++) {
        for (var j = i + 1; j < lines.length; j++) {
            var inter = check_intersection(lines[i], lines[j])
            if (inter != null) intersections_bf.push(inter)
        }
    }
}

function generate_problem() {
    var n = $('#num_lines').val()
    reconstruct_demo(n)
    init_sweepline()
}

function reset_sweepline() {
    segment_list = []
    event_queue = []
    intersections = []
    intersections_bf = []
}

/**
 * Event format:
 * [x, "enter"/"leave"/"intersection", i, (j for intersection)]
 * Segment list will just use indices.
 */

// priority: enter before intersection before leave
function compare_events(a, b) {
    if (a[0] != b[0]) return a[0] < b[0]
    return a[1] < b[1] // convenient string hack
}

// compare lines by left point
function compare_lines(a, b) {
    if (a[0][0] != b[0][0]) return a[0][0] - b[0][0]
    return a[0][1] - b[0][1]
}

function init_sweepline() {
    reset_sweepline()
    if (document.getElementById("brute_force").checked) {
        // brute-forcing
        check_intersections_bf()
        draw_intersections(intersections_bf, "blue", 3)
    }

    // insert events into the queue
    for (var i = 0; i < lines.length; i++) {
        insert_into(event_queue, compare_events, [lines[i][0][0], "enter", i])
        insert_into(event_queue, compare_events, [lines[i][1][0], "exit", i])
    }

    current_x = -100
}

// Run a single step of the event queue.
// Good for demonstration purposes.
function step_sweepline() {
    if (event_queue.length == 0) return

    // debug
    console.log(event_queue)
    console.log(segment_list)

    var evt = event_queue[0]
    event_queue.splice(0, 1)

    // compare lines of index i, j SL style
    // format is top-to-bottom
    current_x = evt[0]
    function compare_SL(i, j) {
        var [m1, b1] = slope_intercept(lines[i])
        var [m2, b2] = slope_intercept(lines[j])
        return (m1 * current_x + b1) > (m2 * current_x + b2)
    }
    
    if (evt[1] == "enter") {
        // var line = lines[evt[2]]
        insert_into(segment_list, compare_SL, evt[2])
    }

    redraw_sweepline_grid() // necessary drawing command
}

function run_sweepline() {
    // While the queue isn't empty...
    while (event_queue.length > 0) {
        step_sweepline()
    }
}

// ----- jQuery -----
// https://stackoverflow.com/questions/30948387/number-only-input-box-with-range-restriction
$(document).ready(function() {
    $('#num_lines').change(function() {
      var n = $('#num_lines').val()
      if (n < 1)
        $('#num_lines').val(1)
      if (n > 20)
        $('#num_lines').val(20)
    })
})