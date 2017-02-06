/*jshint node:true*/
function reportFile() {
  if (_circleTestFolder()) {
    return _circleTestFolder() + '/test_report.xml';
  }
}

function testReporter() {
  return _circleTestFolder() ? 'xunit' : 'tap';
}

function chromeArgs() {
  if (!_circleCI()) {
    return [
      "--no-default-browser-check",
      "--no-first-run",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-background-timer-throttling"
    ];
  }
}

function _circleTestFolder() {
  return process.env['CIRCLE_TEST_REPORTS'];
}

function _circleCI() {
  return process.env['CIRCLECI'];
}

module.exports = {
  "framework": "qunit",
  "test_page": "tests/index.html?hidepassed",
  "disable_watching": true,
  "launch_in_ci": [
    "Chrome",
  ],
  "launch_in_dev": [
    "Chrome",
    "Firefox"
  ],
  "browser_args" : {
    "Chrome": chromeArgs()
  },
  "reporter": testReporter(),
  "report_file": reportFile(),
  "xunit_intermediate_output": true
};
