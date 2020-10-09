const Joi = require('@hapi/joi');

const { createCalendarEvent, deleteCalendarEvent } = require('../helpers/bot/calendar');
const { getRouteScope } = require('./helpers');
const Classes = require('../models/classes');

const buildSchema = (requestType) => {
  return Joi.object({
    title: requestType === 'POST' ? Joi.string().required() : Joi.string().optional(),
    description: requestType === 'POST' ? Joi.string().required() : Joi.string().optional(),
    facilitator_id: Joi.number().integer().greater(0).optional(),
    start_time: requestType === 'POST' ? Joi.date().required().min('now') : Joi.date().optional(),
    end_time:
      requestType === 'POST'
        ? Joi.date().required().greater(Joi.ref('start_time'))
        : Joi.date().optional(),
    exercise_id: Joi.number(),
    course_id: Joi.number(),
    category_id:
      requestType === 'POST'
        ? Joi.number().integer().required()
        : Joi.number().integer().optional(),
    video_id: Joi.string().optional(),
    lang:
      requestType === 'POST'
        ? Joi.string().valid('hi', 'en', 'te', 'ta').lowercase().required()
        : Joi.string().valid('hi', 'en', 'te', 'ta').lowercase().optional(),
    type:
      requestType === 'POST'
        ? Joi.string().valid('workshop', 'doubt_class').required()
        : Joi.string().valid('workshop', 'doubt_class').optional(),
    meet_link: Joi.string().pattern(/\w{3}(-)\w{4}(-)\w{3}/),
    calendar_event_id: Joi.string(),
  });
};

module.exports = [
  {
    method: 'GET',
    path: '/classes/all',
    options: {
      description: 'Get a list of all classes',
      tags: ['api'],
      auth: {
        strategy: 'jwt',
        scope: getRouteScope('admin'),
      },
      handler: async (request) => {
        const { classesService, displayService } = request.services();
        const allClasses = await classesService.getAllClasses();
        return displayService.getUpcomingClassFacilitators(allClasses);
      },
    },
  },
  {
    method: 'GET',
    path: '/classes/upcoming',
    options: {
      description: 'Get a list of all classes user is yet to register to by filters',
      tags: ['api'],
      auth: {
        strategy: 'jwt',
        mode: 'optional',
      },
      validate: {
        query: Joi.object({
          startDate: Joi.date().optional(),
          endDate: Joi.date().min(Joi.ref('startDate')).optional(),
          lang: Classes.field('lang').optional(),
          classType: Classes.field('type').optional(),
        }),
      },
      handler: async (request) => {
        const { classesService, displayService } = request.services();
        const classes = await classesService.getUpcomingClasses(
          request.query,
          request.auth.credentials.id
        );
        return { classes: await displayService.getUpcomingClassFacilitators(classes) };
      },
    },
  },
  {
    method: 'POST',
    path: '/classes',
    options: {
      description: 'Creates a class and returns the created class',
      tags: ['api'],
      auth: {
        strategy: 'jwt',
        scope: getRouteScope('classAdmin'),
      },
      validate: {
        payload: buildSchema('POST'),
      },
      handler: async (request) => {
        const { classesService, userService, displayService } = request.services();
        let { payload } = request;
        if (payload.facilitator_id === undefined) {
          payload = {
            ...payload,
            facilitator_id: request.auth.credentials.id,
          };
        }
        const user = await userService.findById(payload.facilitator_id);
        const facilitator = await displayService.userProfile(user);
        const calendarEvent = await createCalendarEvent(payload, facilitator);

        const meetLink = calendarEvent.data.hangoutLink.split('/').pop();
        payload = {
          ...payload,
          calendar_event_id: calendarEvent.data.id,
          meet_link: meetLink,
        };
        const createdClass = await classesService.createClass(payload);
        return createdClass;
      },
    },
  },
  {
    method: 'GET',
    path: '/classes/{classId}',
    options: {
      description: 'Get details of a class',
      tags: ['api'],
      auth: {
        strategy: 'jwt',
        mode: 'optional',
      },
      validate: {
        params: Joi.object({
          classId: Classes.field('id'),
        }),
      },
      handler: async (request) => {
        const singleClass = [];
        const { classesService, displayService } = request.services();
        const { classId } = request.params;
        const userId = request.auth.credentials.id;
        singleClass.push(await classesService.getClassById(classId));
        const singleClassWithFacilitator = await displayService.getUpcomingClassFacilitators(
          singleClass
        );
        const classDetails = await displayService.getClassDetails(
          singleClassWithFacilitator,
          userId
        );
        return classDetails;
      },
    },
  },
  {
    method: 'PUT',
    path: '/classes/{classId}',
    options: {
      description: 'Updates a class and returns it as response',
      tags: ['api'],
      auth: {
        strategy: 'jwt',
        scope: getRouteScope('classAdmin'),
      },
      validate: {
        params: Joi.object({
          classId: Classes.field('id'),
        }),
        payload: buildSchema('PUT'),
      },
      handler: async (request) => {
        const { classesService } = request.services();
        const { classId } = request.params;
        await classesService.updateClass(classId, request.payload);
        return { updatedClass: await classesService.getClassById(classId) };
      },
    },
  },
  {
    method: 'GET',
    path: '/classes/recommended',
    options: {
      description: 'Get recommended classes',
      tags: ['api'],
      auth: {
        strategy: 'jwt',
        mode: 'optional',
      },
      handler: async (request) => {
        const { classesService, displayService } = request.services();
        const recommended = await classesService.recommendedClasses();
        return displayService.getRecommendedClasses(recommended);
      },
    },
  },
  {
    method: 'DELETE',
    path: '/classes/{classId}',
    options: {
      description: 'Deletes a class (Dashboard Admin only)',
      tags: ['api'],
      auth: {
        strategy: 'jwt',
        scope: getRouteScope('classAdmin'),
      },
      validate: {
        params: Joi.object({
          classId: Classes.field('id'),
        }),
      },
      handler: async (request) => {
        const { classesService } = request.services();
        const classToDelete = await classesService.getClassById(request.params.classId);
        const calendarEventId = classToDelete.calendar_event_id;
        console.log(calendarEventId);
        await deleteCalendarEvent(calendarEventId);
        return classesService.deleteClass(request.params.classId);
      },
    },
  },
];