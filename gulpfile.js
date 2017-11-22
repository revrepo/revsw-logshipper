'use strict';

var gulp = require('gulp');
var path = require('path');
var uglify = require('gulp-uglify');
var htmlhint = require('gulp-htmlhint');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var browserSync = require('browser-sync');
var reload = browserSync.reload;

gulp.task('lintjs', function () {
  return gulp.src([
    'gulpfile.js',
    './templates/**/*.js',
    './routes/**/*.js',
    './models/**/*.js',
    './lib/**/*.js',
    './handlers/**/*.js',
    './bin/**/*.js'
  ])
    .pipe(jshint({
      linter: 'jshint'
    }))
    .pipe(jshint.reporter(stylish));
});

gulp.task('linthtml', function () {
  return gulp.src(['./templates/**/*.html'])
    .pipe(htmlhint('.htmlhintrc'))
    .pipe(htmlhint.failReporter());
});


gulp.task('serve', function () {
  // serve webtest
  require('./bin/revsw-logshipper.js');

  // watch for changes and lint
  gulp.watch([
    './test/**/*.js',
    './routes/**/*.js',
    './models/**/*.js',
    './lib/**/*.js',
    './handlers/**/*.js',
    './bin/**/*.js'], ['lintjs', reload]);

  gulp.watch(['./**/*.html'], ['linthtml', reload]);
});


gulp.task('lint', ['lintjs', 'linthtml']);
gulp.task('default', ['serve', 'linthtml']);