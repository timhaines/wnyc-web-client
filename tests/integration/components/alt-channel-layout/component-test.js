import { moduleForComponent, skip } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('alt-channel-layout', 'Integration | Component | alt channel layout', {
  integration: true
});

skip('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{alt-channel-layout}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#alt-channel-layout}}
      template block text
    {{/alt-channel-layout}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
