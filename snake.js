// ... existing code above ...

function pickWhitespaceReplacementChar() {
  // We want to stay within the Braille block to maintain consistent width.
  // \u2800 is the standard "blank" Braille pattern.
  var candidates = [
    ['\u2800', 'braille blank'], 
    ['\u00A0', 'non-breaking space'],
    ['\u2004', 'three-per-em space']
  ];

  var N = 5;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = '30px system-ui';
  var targetWidth = ctx.measureText(BRAILLE_SPACE.repeat(N)).width;

  for (var i = 0; i < candidates.length; i++) {
    var char = candidates[i][0];
    var str = char.repeat(N);
    var width = ctx.measureText(str).width;
    
    // Check if the width is a match for the Braille grid
    var similarWidth = Math.abs(targetWidth - width) / targetWidth <= 0.1;

    if (similarWidth) {
      return candidates[i];
    }
  }

  // Absolute fallback to Braille Blank
  return ['\u2800', 'braille blank'];
}

var $ = document.querySelector.bind(document);

main();
