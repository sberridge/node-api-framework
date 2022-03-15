'use strict';
import { Express } from "express";

import { AuthFilter} from './../filters/AuthFilter';

module.exports = function(app:Express) {
    const userController = require('../controllers/UserController');

    //app.all('/users',AuthFilter);
    app.route('/users')
        .get(userController.get_users);

    app.route('/auth')
        .get(userController.fake_auth);
};