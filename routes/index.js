
var express = require('express');
var router = express.Router();

import Config from "../config";


var BudgetModel = null,_BudgetModel= null,_BudgetFileModel = null;
if(!Config.file_model){
  _BudgetModel = require('../model/budgetmodel.jsx');
}else{
  _BudgetFileModel = require('../model/budgetfilemodel.jsx');
}
BudgetModel = Config.file_model ? _BudgetFileModel : _BudgetModel;

var fs = require("fs");

var multer  = require('multer');
var upload = multer({ dest: '/tmp/' });

function normalizeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return '';
  }
  var trimmed = basePath.trim();
  if (trimmed[0] !== '/') {
    trimmed = '/' + trimmed;
  }
  return trimmed.replace(/\/+$/, '');
}

function buildSitePath(pathname) {
  var base = normalizeBasePath(Config.base_path);
  if (!pathname) {
    return base || '/';
  }
  if (pathname[0] !== '/') {
    pathname = '/' + pathname;
  }
  return (base || '') + pathname;
}

function buildBubblePath(budgetId) {
  return buildSitePath('bubble/' + budgetId);
}

function buildListPath() {
  return buildSitePath('list');
}

function resolveFeaturedBudgetId() {
  var configuredId = parseInt(Config.featured_budget_id, 10);
  if (Number.isNaN(configuredId)) {
    return null;
  }
  return configuredId;
}


/* GET home page. */
router.get('/', function(req, res, next) {
  var featuredId = resolveFeaturedBudgetId();
  var budgetPromise = null;

  if (featuredId != null) {
    budgetPromise = BudgetModel.get(featuredId);
  } else {
    budgetPromise = BudgetModel.getAll(1, 1).then(function(budgets){
      if(!budgets || !budgets.length){
        return null;
      }
      var first = budgets[0];
      var id = first && first.id != null ? first.id : null;
      if(id == null){
        return null;
      }
      return BudgetModel.get(id);
    });
  }

  budgetPromise.then(function(data){
    if(!data){
      return res.redirect(buildListPath());
    }

    res.redirect(buildBubblePath(data.id));
  }).catch(next);
});

router.get('/list', function(req, res, next) {

  BudgetModel.getAll(1,1000).then(function(budgets){
    res.render('dispatch.jsx',
    {
      comp:'index',
      layout:'default',
      nav:"list",
      basePath: Config.base_path || '',
      pageInfo:{
        title:"預算視覺化產生器",
        "ogimage":"",
        description:"迅速產生預算視覺化",
      },
      views:{
        default_view:Config.default_view=="drilldown" ? "drilldown":"bubble",
        budgets:budgets
      }
    });
  }).catch(next);

});


router.get('/drilldown/:id', function(req, res, next) {
  var budget = req.params.id;
  BudgetModel.get(budget).then(function(data){
    res.render('dispatch.jsx',
    {
      comp:'drilldown',
      layout:'front',
      nav:"drilldown",
      budget_id:budget,
      basePath: Config.base_path || '',
      pageInfo:data,
      views:{
        budget_links:data.budgets,
        budget_id:data.id,
        budget_file_type:data.budget_file_type,
        budget_meta_links:data.meta_links
      }
    });
  });
});


router.get('/bubble/:id', function(req, res, next) {
  var budget = req.params.id;
  BudgetModel.get(budget).then(function(data){

    res.render('dispatch.jsx',
    {
      comp: data.budget_file_type == "2" ? 'bubble-gov': 'bubble',
      layout:'front',
      nav:"bubble",
      budget_id:budget,
      basePath: Config.base_path || '',
      pageInfo:data,
      views:{
        budget_links:data.budgets,
        budget_id:data.id,
        budget_file_type:data.budget_file_type,
        budget_meta_links:data.meta_links

      }
    });
  });
});


router.get('/bubble-test', function(req, res, next) {
  var budget = req.query.file;
  var budget_type = req.query.type || 0;

  res.render('dispatch.jsx', 
  { 
    comp:'bubble',
    layout:'front',
    nav:"home",
    budget_id:-1,
    basePath: Config.base_path || '',
    pageInfo:{},
    views:{
      budget_links:[budget],
      budget_id:-1,
      budget_file_type:budget_type
    }
  });
});


router.get('/radar-test', function(req, res, next) {

  res.render('dispatch.jsx', 
  { 
    comp:'radar',
    layout:'front',
    nav:"home",
    budget_id:-1,
    basePath: Config.base_path || '',
    pageInfo:{},
    views:{
    }
  });
});


router.get('/table/:id/:type?', function(req, res, next) {
  var budget = req.params.id;
  // console.log("type",req.params.type);

  var allowType = {'all':1,'topname':1,'depname':1,'category':1};
  if(req.params.type != null && allowType[req.params.type] == null){
    return next();
  }

  BudgetModel.get(budget).then(function(data){
    res.render('dispatch.jsx',
    {
      comp:'table',
      layout:'front',
      nav:"table",
      basePath: Config.base_path || '',
      pageInfo:data,
      views:{
        _subnav:req.params.type || 'all',
        budget_links:data.budgets,
        budget_id:data.id,
        budget_file_type:data.budget_file_type,
        budget_meta_links:data.meta_links
      }
    });
  });
});




router.get('/upload', function(req, res, next) {
  res.render('dispatch.jsx', 
  { 
    comp:'upload',
    layout:'default',
    nav:"upload",
    basePath: Config.base_path || '',
    pageInfo:{
      title:"預算視覺化平台"
    },
    views:{
    }
  });

});



router.post('/uploading', upload.single('file'), function(req, res, next) {
  // console.log(req.file);
// { fieldname: 'file',
//   originalname: 'testbudget.csv',
//   encoding: '7bit',
//   mimetype: 'text/csv',
//   destination: '/tmp/',
//   filename: '50409340425fbf2c839cfbd03da84463',
//   path: '/tmp/50409340425fbf2c839cfbd03da84463',
//   size: 38961 }
  var content = fs.readFileSync(req.file.path).toString();

  // console.log(content);
  
});


module.exports = router;


