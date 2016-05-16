import { test } from 'qunit';
import moduleForAcceptance from 'overhaul/tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | discover');

test('can visit discover from the home page', function(assert) {
  visit('/');

  andThen(function() {
    click('.l-page-nav .list-item [href*="discover"]');

    andThen(function() {
      assert.equal(currentURL(), '/discover/start');
    });
  });
});

test('button exists to create new discover station', function(assert) {
  visit('/discover/start');
  server.createList('discover-topic', 20);

  andThen(function() {
    click('button#discover_station_create_button');

    andThen(function() {
      assert.equal(currentURL(), '/discover/start/topics');
    });
  });
});

test('shows list of topics', function(assert) {
  visit('/discover/start');
  server.createList('discover-topic', 20);

  andThen(function() {
    click('button#discover_station_create_button');
    andThen(function() {
      assert.equal($(".discover-topic").length, 20);
    });
  });
});

test('next button is disabled until a topic is selected', function(assert) {
  visit('/discover/start');
  server.createList('discover-topic', 20);

  andThen(function() {
    click('button#discover_station_create_button');
    andThen(function() {
      assert.equal(currentURL(), '/discover/start/topics');
      assert.equal($('button:contains("Next")').prop("disabled"), true, "Button should be disabled");
      click(".discover-topic input");
      andThen(function() {
        assert.equal($('button:contains("Next")').prop("disabled"), false, "Button should be enabled");
      });
    });
  });
});

test('topics are saved in a session and maintained upon next visit in initial flow', function(assert) {
  visit('/discover/start');
  server.create('discover-topic', {title: "Music", url: "music"});
  server.create('discover-topic', {title: "Art", url: "art"});
  server.create('discover-topic', {title: "Technology", url: "technology"});
  click('button#discover_station_create_button');

  andThen(function() {
    assert.equal(currentURL(), '/discover/start/topics');
    click(".discover-topic input[name='music']");
    andThen(function() {
      click("button:contains('Next')");
      andThen(function() {
        visit('/discover/start/topics');
        andThen(function() {
          assert.equal($(".discover-topic input[name='music']").prop('checked'), true, "Checkbox was not checked");
          assert.equal($(".discover-topic input[name='art']").prop('checked'), false, "Checkbox was checked when it shouldn't be");
          assert.equal($(".discover-topic input[name='technology']").prop('checked'), false, "Checkbox was checked when it shouldn't be");
        });
      });
    });
  });
});
