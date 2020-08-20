const Joi = require('@hapi/joi');
const _ = require('lodash');
const ModelBase = require('./helpers/ModelBase');
const CONFIG = require('../config');

module.exports = class ProgressParameter extends ModelBase {
  static get tableName() {
    return 'main.progress_parameters';
  }

  static get joiSchema() {
    return Joi.object({
      id: Joi.number().integer().greater(0),
      type: Joi.string()
        .valid(..._.keys(CONFIG.progressTracking.parameters.type))
        .required(),
      min_range: Joi.integer().when('type', {
        is: CONFIG.progressTracking.parameters.type.range,
        then: Joi.integer().required(),
      }),
      max_range: Joi.integer().when('type', {
        is: CONFIG.progressTracking.parameters.type.range,
        then: Joi.integer().required(),
      }),
      created_at: Joi.date(),
    });
  }
};