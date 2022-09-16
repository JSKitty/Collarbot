// Terminal CLI colour bytes (30-37 byte SGR parameter range)
const COLOURS = {
    BLACK:   '0',
    RED:     '1',
    GREEN:   '2',
    YELLOW:  '3',
    BLUE:    '4',
    MAGENTA: '5',
    CYAN:    '6',
    WHITE:   '7'
}

function colour(bytes, text) {
    return '\x1b[3' + bytes + 'm' + text + '\033[0m';
}

module.exports = {
    colour,
    // Hardcoded colour methods (faster to use)
    black:   (text) => colour(COLOURS.BLACK,   text),
    red:     (text) => colour(COLOURS.RED,     text),
    green:   (text) => colour(COLOURS.GREEN,   text),
    yellow:  (text) => colour(COLOURS.YELLOW,  text),
    blue:    (text) => colour(COLOURS.BLUE,    text),
    magenta: (text) => colour(COLOURS.MAGENTA, text),
    cyan:    (text) => colour(COLOURS.CYAN,    text),
    white:   (text) => colour(COLOURS.WHITe,   text),
}