import { Factory, faker } from 'ember-cli-mirage';

function bucketItems() {
  var res = [];
  for (let i = 0; i < 5; i++) {
    res.push({
      slug: faker.lorem.words().join('-'),
      producingOrganizations: []
    });
  }
  return res;
}

export default Factory.extend({
  bucketItems
});
