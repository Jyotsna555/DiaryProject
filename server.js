require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const lodash = require("lodash");
const mongoose = require("mongoose");

const session = require("express-session");
const pssport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const passport = require("passport");


const app = express();
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret:"mysecret",
    resave:false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//mongoose.connect("mongodb://localhost:27017/diary2", {useNewUrlParser:true, useUnifiedTopology: true, useFindAndModify:false});
mongoose.connect("mongodb+srv://admin_jyotsna:"+process.env.MONGOPASSWORD+"@cluster0.bqhnk.mongodb.net/diary", {useNewUrlParser:true, useUnifiedTopology: true, useFindAndModify:false});

mongoose.set("useCreateIndex", true);

const myentryobject={
  entryheading: String,
  entrybody:String,
  day: String
};

const userSchema=new mongoose.Schema({
    username: String,
    password: String,
    entries:[myentryobject]
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("user", userSchema);


passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

let alertnotice="";
let oldsource="";

app.get("/", function(req,res){
    res.render("home", {pageHeading: "HOME"});
});

app.get("/alert", function(req,res){
    res.render("alert", {pageHeading: "OOPS", alertnotice: alertnotice});
});

app.post("/homelogin", function(req,res){
    res.redirect("/login");
});
app.post("/homesignup", function(req,res){
    res.redirect("/signup");
});

app.get("/login", function(req,res){
    res.render("login", {pageHeading: "Login"});
});

app.post("/login", function(req,res){
    const usern = req.body.username;
    const pword = req.body.password;

    const user = new User({
        username: usern,
        password: pword
    });

    req.login(user, function(err){
        if(err){
            console.log("loggin in error: "+err);
            res.redirect("/login");
        }
        else{
            passport.authenticate("local")(req, res, function(){
              console.log(req.user.username + " wants to log in!");
              oldsource=usern;
              res.redirect("/diary/"+usern);
            });
        }
    });

});

app.get("/signup", function(req, res){
    res.render("signup", {pageHeading: "Signup"});
});

let usern = "";
let pword = "";

app.post("/signup", function(req, res){
  usern = req.body.username;
  pword = req.body.password;

  User.findOne({ username: usern }, function (err, founduser) {
    if (!err) {
      console.log("checking for repeated username");

      if (founduser) {
        console.log("username already exists:  " + founduser);
        alertnotice = "Username is already taken, could not sign up! 🤡";
        res.redirect("/alert");
      } else {
        console.log("registering user...");

        User.register({ username: usern }, pword, function (error, user) {
          if (error) {
            console.log(error);
            res.redirect("/signup");
          } else {
            passport.authenticate("local")(req, res, function () {
            oldsource=usern;
            res.redirect("/diary/" + usern);
            });
          }
        });
      }
    }
  });

});

app.get("/diary/:username", function (req, res) {
  const diaryuser = req.params.username;

  User.findOne({username: diaryuser}, function(err, founduser){
    console.log("req.user is "+req.user);
    console.log("founduser is "+founduser);
    console.log("oldosurce is "+oldsource);
    if(!err && founduser.username == oldsource){
      if(req.isAuthenticated()){
        console.log(req.user.username + " is authenticated.");

        console.log("Sending you to " + req.user.username + "'s personal diary page!");
        oldsource = usern;
        res.render("diary", {pageHeading: "Diary of " + diaryuser, userentries: founduser.entries.reverse(),username: diaryuser});
      } 
      else{
        alertnotice="Access Denied. Go back.";
        res.redirect("/alert");
      }
    }
    else{
      console.log("BREACH");
      alertnotice="Breach! Access Denied. Go back.";
      res.redirect("/alert");
    }
    
  });

});

app.post("/deleteentries/:username", function(req, res){
    const diaryuser = req.params.username;
    oldsource = req.body.deleteentries;
    const newentries = [];
    req.user.entries = newentries;
    req.user.save();

    res.redirect("/diary/"+diaryuser);
});

app.post("/createentry/:username", function(req, res){
    const diaryuser = req.params.username;
    oldsource = req.body.createentry;
    res.redirect("/create/"+diaryuser);
});

app.get("/create/:username", function(req, res){
    const diaryuser = req.params.username;
    console.log("req.user is "+req.user);
    console.log("diaryuser is "+diaryuser);
    console.log("oldosurce is "+oldsource);

    User.findOne({username:diaryuser}, function(err, founduser){
      console.log("create diary??");
      if(req.isAuthenticated()){
        res.render("create", {pageHeading: "Create a New Diary Entry", username: diaryuser});
      }else if(oldsource!=diaryuser){
        alertnotice="Access Denied. You cannot create on someone else's page";
        res.redirect("/alert");
      }
    })
    // if(req.isAuthenticated() && olduser==req.user.username){
    //   res.render("create", {pageHeading: "Create a New Diary Entry", username: diaryuser});
    // }else{
    //   alertnotice="Access Denied.";
    //   res.redirect("/alert");
    // }

    //res.render("create", {pageHeading: "Create a New Diary Entry", username: diaryuser});
});
app.post("/create/:username", function(req, res){
    const diaryuser = req.params.username;
    const heading = req.body.heading;
    const bod = req.body.bod;
    oldsource = req.body.create;

    const today = new Date();

    const options = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      };
    
      //return today.toLocaleDateString("en-US", options);
    const newobj={
        entryheading: heading,
        entrybody: bod,
        day: today.toLocaleDateString("en-US", options)
    };
    //newobj.save();

    console.log("created an object");
    console.log(newobj);

    User.findOne({ username: diaryuser }, function (err, founduser) {
      if (!err) {
        founduser.entries.push(newobj);
        founduser.save();
        console.log("entries is :" + founduser.entries);
        console.log("Pushed new entry into correct user!");
        res.redirect("/diary/" + diaryuser);
      }
      else{
        console.log("There was some error in storing");
        alertnotice="Error in creating new entry! Go back.";
        res.redirect("/alert");
      }
    });

    // Entry.findOne({username:diaryuser}, function(err, founduser){
    //     if(!err){
    //         founduser.entries.push(newobj);
    //         founduser.save();
    //         console.log("entries is :" + founduser.entries);
    //         console.log("Pushed new entry into correct user!");
    //         res.redirect("/diary/"+diaryuser);
    //     }
    //     else{
    //         console.log("There was some error in storing ")
    //     }
    // });
});
app.post("/logout/:username", function(req, res){
    const loggoutuser = req.params.username;

    // console.log("Loggin " + req.user +" out...");
    // req.logout();

    User.find({username: loggoutuser}, function(err, founduser){
      if(!err){
        console.log("Loggin " + req.user +" out...");
        req.logout();
        res.redirect("/");
      }
      else{
        console.log(err);
      }
    })

    
});


app.listen(process.env.PORT || 3000, function(){
    console.log("Server is up and running!");
});