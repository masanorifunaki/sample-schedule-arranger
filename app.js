var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
// セキュリティ対策用
var helmet = require('helmet');
// GitHub認証用
// Express でセッションを利用できるようにするためのモジュール
// 認証した結果をセッション情報として維持する
var session = require('express-session');
// 様々な Web サービスとの外部認証を組み込むためのプラットフォームとなる
// ライブラリ
var passport = require('passport');

// リレーションの設定
// モデルを使ってエンティティ同士の関係を定義しておくことで、
// 後で自動的に RDB 上でテーブルの結合をしてデータを取得する
var User = require('./models/user');
var Schedule = require('./models/schedule');
var Availability = require('./models/availability');
var Candidate = require('./models/candidate');
var Comment = require('./models/comment');

User.sync().then(() => {
  Schedule.belongsTo(User, {
    foreignKey: 'createdBy'
  });
  Schedule.sync();
  Comment.belongsTo(User, {
    foreignKey: 'userId'
  });
  Comment.sync();
  Availability.belongsTo(User, {
    foreignKey: 'userId'
  });
  Candidate.sync().then(() => {
    Availability.belongsTo(Candidate, {
      foreignKey: 'candidateId'
    });
    Availability.sync();
  });
});


// passport-github2 は、 passport が GitHub の認証を利用するためのモジュール
// Strategy （戦略）モジュールと呼ぶ
var GitHubStrategy = require('passport-github2').Strategy;
var GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
var GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

// serializeUser には、
// ユーザーの情報をデータとして保存する処理を記述
// done 関数は、第一引数にはエラーを、第二引数には結果をそれぞれ含めて実行する
passport.serializeUser(function (user, done) {
  done(null, user);
});
// deserializeUser は、
// 保存されたデータをユーザーの情報として読み出す際の処理を記述
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

// passport モジュールに、 GitHub を利用した認証の戦略オブジェクトを設定
passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: process.env.HEROKU_URL ? process.env.HEROKU_URL + 'auth/github/callback' : 'http://localhost:8000/auth/github/callback'
  },
  // データベースにユーザー情報を保存
  function (accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      // 取得されたユーザー ID とユーザー名を User のテーブルに保存
      // upsert 関数は、 INSERT または UPDATE を行うという意味
      User.upsert({
        userId: profile.id,
        username: profile.username
      }).then(() => {
        done(null, profile);
      });
    });
  }
));

// Router オブジェクトの設定
// ルーターモジュールの読み込み
var index = require('./routes/index');
var login = require('./routes/login');
var logout = require('./routes/logout');
var schedules = require('./routes/schedules');
var availabilities = require('./routes/availabilities');
var comments = require('./routes/comments');

var app = express();
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// express-session と passport でセッションを利用するという設定
app.use(session({
  secret: 'e55be81b307c1c09',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// ハンドラの実装
app.use('/', index);
app.use('/login', login);
app.use('/logout', logout);
app.use('/schedules', schedules);
app.use('/schedules', availabilities);
app.use('/schedules', comments);

// GitHub への認証を行うための処理を、
// GET で /auth/github にアクセスした際に行う
// リクエストが行われた際の処理もなにもしない関数として登録
// 認証実行時にログを出力する必要性がある場合にはこの関数に記述する
app.get('/auth/github',
  passport.authenticate('github', {
    scope: ['user:email']
  }),
  function (req, res) {

  }
);
// GitHub が利用者の許可に対する問い合わせの結果を送るパス
// auth/github/callbackのハンドラを登録
app.get('/auth/github/callback',
  passport.authenticate('github', {
    // 認証が失敗した際には、再度ログインを促す /login にリダイレクト
    failureRedirect: '/login'
  }),
  function (req, res) {
    var loginFrom = req.cookies.loginFrom;
    // オープンリダイレクタ脆弱性対策
    if (loginFrom && loginFrom.indexOf('http://') < 0 && loginFrom.indexOf('https://') < 0) {
      res.clearCookie('loginFrom');
      res.redirect(loginFrom);
    } else {
      res.redirect('/');
    }
  });

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;