import loadingIcon from 'wnyc-web-client/utils/animated-loading-icon';
import { module, test } from 'qunit';

module('Unit | Utility | animated loading icon');

// Replace this with your real tests.
test('it works', function(assert) {

  let canvas = document.createElement('canvas');
  let result = loadingIcon(canvas, {});
  assert.ok(result);
});
