'use strict';

var colors = require('colors');
var path = require('path');
var specialKeys = require('selenium-webdriver').Key;

var imageOperations = require('../imageOperations');
var consts = require('../constants');

function _simulateScreenshot(
  driver,
  recordPath,
  screenshotName,
  overrideScreenshots,
  next
) {
  console.log('  Taking screenshot ' + screenshotName);

  driver
    .takeScreenshot()
    // TODO: isolate the logic for saving image outside of this unrelated step
    .then(function(tempImage) {
      var oldImagePath = path.join(recordPath, screenshotName);
      if (overrideScreenshots) {
        return imageOperations.writeToFile(oldImagePath, tempImage, next);
      }

      imageOperations.compareAndSaveDiffOnMismatch(
        tempImage,
        oldImagePath,
        recordPath,
        function(err, areSame) {
          if (err) return next(err);

          if (!areSame) {
            return next(
              'New screenshot looks different. ' +
              'The diff image is saved for you to examine.'
            );
          }

          next();
        }
      );
    });
}

function _simulateKeypress(driver, key, next) {
  console.log('  Typing ' + key);

  driver
    .executeScript('return document.activeElement;')
    .then(function(activeElement) {
      if (!activeElement) return next();

      // refer to `actionsTracker.js`. The special keys are the arrow keys,
      // stored like 'ARROW_LEFT', By chance, the webdriver's `Key` object
      // stores these keys
      if (key.length > 1) key = specialKeys[key];
      activeElement
        .sendKeys(key)
        .then(next);
    });
}

// TODO: handle friggin select menu click, can't right now bc browsers
function _simulateClick(driver, posX, posY, next) {
  var posString = '(' + posX + ', ' + posY + ')';
  console.log('  Clicking ' + posString);

  driver
    // TODO: isolate this into a script file clicking on an input/textarea
    // element focuses it but doesn't place the carret at the correct position;
    // do it here (only works for ff)
    .executeScript(
      'var el = document.elementFromPoint' + posString + ';' +
      'if ((el.tagName === "TEXTAREA" || el.tagName === "INPUT") && document.caretPositionFromPoint) {' +
        'var range = document.caretPositionFromPoint' + posString + ';' +
        'var offset = range.offset;' +
        'document.elementFromPoint' + posString + '.setSelectionRange(offset, offset);' +
      '}' +
      'return document.elementFromPoint' + posString + ';'
    )
    .then(function(el) {
      el.click();
    })
    .then(next);
}

function _simulateScroll(driver, posX, posY, next) {
  var posString = '(' + posX + ', ' + posY + ')';
  console.log('  Scrolling to ' + posString);

  driver
    .executeScript('window.scrollTo(' + posX + ',' + posY + ')')
    .then(next);
}

function playback(playbackInfo, next) {
  var currentEventIndex = 0;
  var screenshotIndex = 1;

  var browserName = playbackInfo.browserName;
  var driver = playbackInfo.driver;
  var events = playbackInfo.recordContent;
  var overrideScreenshots = playbackInfo.overrideScreenshots;
  var recordPath = playbackInfo.recordPath;

  // pass `_next` as the callback when the current simulated event
  // completes
  function _next(err) {
    if (err) return next(err);

    var currentEvent = events[currentEventIndex];
    var fn;

    if (currentEventIndex === events.length - 1) {
      fn = _simulateScreenshot.bind(
        null,
        driver,
        recordPath,
        imageOperations.getImageName(browserName, screenshotIndex),
        overrideScreenshots,
        function(err) {
          imageOperations.removeDanglingImages(
            playbackInfo.recordPath,
            browserName,
            screenshotIndex + 1,
            function(err2) {
              next(err || err2 || null);
            }
          );
        }
      );
    } else {
      switch (currentEvent.action) {
        case consts.STEP_CLICK:
          fn = _simulateClick.bind(
            null, driver, currentEvent.x, currentEvent.y, _next
          );
          break;
        case consts.STEP_KEYPRESS:
          fn = _simulateKeypress.bind(null, driver, currentEvent.key, _next);
          break;
        case consts.STEP_SCREENSHOT:
          fn = _simulateScreenshot.bind(
            null,
            driver,
            recordPath,
            imageOperations.getImageName(browserName, screenshotIndex++),
            overrideScreenshots,
            _next
          );
          break;
        case consts.STEP_PAUSE:
          fn = function() {
            console.log('  Pause for %s ms'.grey, currentEvent.ms);
            setTimeout(_next, currentEvent.ms);
          };
          break;
        case consts.STEP_SCROLL:
          // this is really just to provide a visual cue during replay. Selenium
          // records the whole page anyways
          // we should technically set a delay here, but OSX' smooth scrolling
          // would look really bad, adding the delay that Selenium has already
          fn = _simulateScroll.bind(
            null,
            driver,
            currentEvent.x,
            currentEvent.y,
            _next
          );
          break;
      }
    }

    currentEventIndex++;
    fn();
  }

  // Selenium chromedriver screenshot captures the scrollbar, whose changing
  // transparency screws with the screenshot diffing. Hide it. This doesnt work
  // on firefox; fortunately, Selenium also doesn't capture the scroll bar in
  // screenshot in ff

  // it seems that we also need to trigger a scrolling to make the hiding work
  if (browserName === 'chrome') {
    driver.executeScript(
      'document.styleSheets[0].insertRule("body::-webkit-scrollbar {width: 0 !important}", 0);' +
      'var oldOverflowValue = document.body.style.overflow;' +
      'document.body.style.overflow = "hidden";' +
      'window.scrollTo(0, 10);' +
      'window.scrollTo(0, 0);' +
      'document.body.style.overflow = oldOverflowValue;'
    )
    .then(_next);
  } else {
    _next();
  }
}

module.exports = playback;
