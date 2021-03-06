const express = require('express')
const passport = require('passport')
const cors = require('cors')
const HeaderAPIKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy
const { DB } = require('./lib/rate')
const { param,validationResult } = require('express-validator');
const app = express()
const api = process.env.API_KEY

DB.start()

//app.use(cors())                                                                                                 //По умолчанию поддержка запросов с любых источников

passport.use(new HeaderAPIKeyStrategy(                                                                          //Api key передаётся в заголовке
    { header: 'api-key'},
    false,
    function(apikey, done) {
        if (apikey!=api) { return done('err'); }
        return done(null, 'ok');
    }
  ));

app.get('/courceall/:date',
    passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),            
    param('date', 'incorrect date').isDate({ format:'DD/MM/YYYY' }).isLength({ min:10, max: 10 }),              //валидация запроса по формату даты и длине строки
    async (req,res)=>{
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        DB.log('date')
        const result = await DB.findAll({ where: { date: req.params.date } })
        res.json(result)
    }
)

app.get('/pair/:currency1/:currency2',
    passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
    param('currency1','incorrect currency 1').isLength({ min:3, max:3 }),                                      //валидация ваалюты по длине
    param('currency2','incorrect currency 2').isLength({ min:3, max:3 }),
    async (req,res)=>{
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        DB.log('pair')
        await DB.get_pair(req.params)
        res.json(result)
    }
)

app.get('/api/unauthorized', (req,res) => {
    res.json({ message: "Wrong api key" })
})

app.listen(3000,()=>console.log('server started'))

