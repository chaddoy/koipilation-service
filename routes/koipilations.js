'use strict';

const uuid = require('node-uuid');
const Joi = require('joi');
const Boom = require('boom');

exports.register = function(server, options, next) {
	const db = server.plugins['db'].db;

	const renameAndClearFields = (doc) => {
		doc.id = doc._id;
		delete doc._id;

		delete doc.creator;
		delete doc.upvoters;
	};

	server.route({
		method: 'GET',
		path: '/koipilations',
		handler: function(request, reply) {
			let sort;

			if (request.query.sort === 'top') {
				sort = {
					$sort: {
						upvotes: -1
					}
				};
			} else {
				sort = {
					$sort: {
						created: -1
					}
				};
			}

			db.koipilations.aggregate({
				$project: {
					title: 1,
					url: 1,
					created: 1,
					upvotes: {
						$size: "$upvoters"
					}
				}
			}, sort, (err, docs) => {
				if (err) {
					throw err;
				}

				docs.forEach(renameAndClearFields)

				return reply(docs);
			});
		},
		config: {
			validate: {
				query: {
					sort: Joi.string().valid('top', 'new').default('top')
				}
			}
		}
	});

	server.route({
		method: 'GET',
		path: '/koipilations/{id}',
		handler: function(request, reply) {
			db.koipilations.findOne({
				_id: request.params.id
			}, (err, doc) => {
				if (err) throw err;

				if (!doc) {
					return reply(Boom.notFound());
				}

				doc.upvotes = doc.upvoters.length;

				renameAndClearFields(doc);

				return reply(doc);
			})
		}
	});

	server.route({
		method: 'POST',
		path: '/koipilations',
		handler: function(request, reply) {

			const koipilations = request.payload;

			koipilations._id = uuid.v1();
			koipilations.created = new Date();
			koipilations.creator = '';
			koipilations.upvoters = [];
			koipilations.upvotes = 0;

			db.koipilations.save(koipilations, (err, result) => {
				if (err) throw err;

				renameAndClearFields(koipilations);
				return reply(koipilations).code(201);
			});
		},
		config: {
			validate: {
				payload: {
					title: Joi.string().min(1).max(100).required(),
					url: Joi.string().uri().required()
				}
			}
		}
	});

	server.route({
		method: 'PATCH',
		path: '/koipilations/{id}',
		handler: function(request, reply) {
			db.koipilations.update({
				_id: request.params.id
			}, {
				$set: request.payload
			}, (err, result) => {
				if (err) throw err;

				if (result.n === 0) {
					return reply(Boom.notFound());
				}

				return reply().code(204);
			});
		},
		config: {
			validate: {
				payload: Joi.object({
					title: Joi.string().min(1).max(100).optional(),
					url: Joi.string().uri().optional()
				}).required().min(1)
			}
		}
	});

	server.route({
		method: 'DELETE',
		path: '/koipilations/{id}',
		handler: function(request, reply) {
			db.koipilations.update({
				_id: request.params.id
			}, (err, result) => {
				if (err) throw err;

				if (result.n === 0) {
					return reply(Boom.notFound());
				}

				return reply().code(204);
			});
		}
	});

	server.route({
		method: 'POST',
		path: '/koipilations/{id}/upvote',
		handler: function(request, reply) {
			db.koipilations.update({
				_id: request.params.id
			}, {
				$addToSet: {
					upvoters: ''
				}
			}, (err, result) => {
				if (err) throw err;

				if (result.n === 0) {
					return reply(Boom.notFound());
				}

				return reply().code(204);
			});
		}
	});

	return next();
};

exports.register.attributes = {
	name: 'routes-koipilations',
	dependencies: ['db']
};
