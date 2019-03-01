var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var ecc = require('eccjs');

var User = require('../models/user');
var Register = require('../models/register');

// Register
router.get('/register', function(req, res){
	res.render('register');
});

router.get('/change', function(req, res){
  res.render('change');
});

// Login
router.get('/login', function(req, res){
	res.render('login');
});

router.get('/forgot', function(req, res){
  res.render('forgot');
});

// Register User
router.post('/register', function(req, res){
	var email = req.body.email;
	var password = req.body.password;
	var password2 = req.body.password2;

	// Validation
	req.checkBody('email', 'Email is required').notEmpty();
	req.checkBody('email', 'Email is not valid').isEmail();
	req.checkBody('password', 'Password is required').notEmpty();
	req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

	var errors = req.validationErrors();

	if(errors){
		res.json({success : "False", message: errors });
	} 
	else {
   	Register.getRegisterByEmail(email, function(err, user){
   			if(err) throw err;
   			if(user){
   				res.json({success : "False", message: "Email exists" });
   			}
   			else{
					res.json({success : "True"});	
   			}
			});
   	}
});

passport.use(new LocalStrategy(
  function(username, password, done) {
   User.getUserByUsername(username, function(err, user){
   	if(err) throw err;
   	if(!user){
   		return done(null, false, {message: 'Unknown User'});
   	}

   	User.comparePassword(password, user.password, function(err, isMatch){
   		if(err) throw err;
   		if(isMatch){
   			return done(null, user);
   		} else {
   			return done(null, false, {message: 'Invalid password'});
   		}
   	});
   });
  }));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.getUserById(id, function(err, user) {
    done(err, user);
  });
});

router.post('/login',
  passport.authenticate('local', {failureRedirect:'/users/login'}),
  function(req, res) {
  	req.flash('success_msg', 'Welcome User');
    res.redirect('/');
  });

router.post('/forgot', function(req, res) {
  var email = req.body.email;
  Register.getRegisterByEmail(email, function(err, user){
        if(err) throw err;
        if(user){
          res.json({success : "True", message: ecc.sjcl.codec.hex.fromBits(ecc.sjcl.hash.sha256.hash(user.email)) });
        }
        else{
          res.json({success : "False"}); 
        }
    });
});

router.get('/forgot1', function(req, res){ 
  var userhash = req.query.userhash;
  var email = req.query.email;
  Register.getRegisterByEmail(email, function(err, user){
        if(err) throw err;
        if(user){
          if(ecc.sjcl.codec.hex.fromBits(ecc.sjcl.hash.sha256.hash(user.email)) == userhash){
            res.render("forgot1");
          }
          else{
            res.redirect("/");
          }
        }
        else{
          res.redirect("/");
        }
    });
});

router.get('/logout', function(req, res){
	req.logout();
	req.flash('success_msg', 'You are logged out');
	res.redirect('/users/login');
});

module.exports = router;
