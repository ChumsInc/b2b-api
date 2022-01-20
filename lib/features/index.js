
'use strict';

const router = require('express').Router();
const slides = require('./slides');

router.get('/slides/:id(\\d+)?', slides.getSlides);
router.get('/slides/active', slides.getActiveSlides);

exports.router = router;
