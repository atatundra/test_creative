const https = require('https')
const { Client } = require('pg')
let currency_api = process.env.CURRENCYFREAKS_API_KEY
let url = `https://api.currencyfreaks.com/latest?apikey=${currency_api}&symbols=USD,EUR,JPY,RUB`

const client = new Client({
    user: process.env.POSTGRES_USER,
    host: 'data_base',
    database: 'currency',
    password: process.env.POSTGRES_PASSWORD
})

client.connect()


let currency_request = function (url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) =>{
            let data = ''
            res.on('data',  chunk => data += chunk )
            res.on('end',   () => resolve(data))
            res.on('error', e => reject(e))
        })
    })
}

let today_full_date = function () {
    let today  = new Date(Date.now())
    return `${today.getDate() <10 ? 0 : ''}${today.getDate()}-${today.getMonth()+1 <10 ? 0 : ''}${today.getMonth()+1}-${today.getFullYear()}`

}

let push = () => {
    currency_request(url)
    .then((res) => {
        res=JSON.parse(res)
        client.query({    text: 'INSERT INTO day_course(date, eur, jpy, rub) VALUES($1, $2, $3, $4)',
                      values: [today_full_date(), res.rates.EUR, res.rates.JPY, res.rates.RUB]
                 }, (err,res)=>console.log(res))
    })
    
}

let check = () => {                                                                             //проверка записи на текущую дату
    client.query(`SELECT * FROM day_course WHERE date='${today_full_date()}'`)
        .then( res => {
            if(res.rowCount==0) push()
        })
}

let timer = () => {                                                                             //обновление и запись в БД курса валют в назначенное время
    let today  = new Date(Date.now())
    let clock = 12
    let timeout = ((1000*3600*24)-(today.getMilliseconds()+((today.getSeconds()*1000)+(today.getMinutes()*60*1000)+(today.getHours()*3600*1000))))-((1000*3600*24)-(1000*3600*clock))
    if(Math.sign(timeout)==-1) timeout = (1000*3600*24)+timeout
    let interval = 1000*3600*24

    let update_query = () => {
        currency_request(url)
        .then((res) => {
            res=JSON.parse(res)
            client.query({    text: 'UPDATE day_course SET eur=$2, jpy=$3, rub=$4 WHERE date = $1',
                            values: [today_full_date(), res.rates.EUR, res.rates.JPY, res.rates.RUB]
                        }, (err,res)=>{ console.log('updated') })
        })
    }
    
    setInterval(check, 1000*3600);

    let update = function () {
        update_query()
        setInterval(update_query,interval)
    }

    setTimeout(update, timeout);

    
}

let fist_write = () => {
        
    let five_day_earler = new Date(Date.now() - 1000*3600*24*5)
    let last_five_day_url = `https://api.currencyfreaks.com/timeseries?apikey=${currency_api}&start_date=${five_day_earler.getFullYear()}-${five_day_earler.getMonth()+1 < 10 ? 0 : ''}${five_day_earler.getMonth()+1}-${five_day_earler.getDate()}&end_date=${today.getFullYear()}-${today.getMonth()+1 < 10 ? 0 : ''}${today.getMonth()+1}-${today.getDate()}&base=USD&symbols=EUR,JPY,RUB`
    
    currency_request(last_five_day_url)
    .then((res)=>{
        if(res.success){
            for (const day of res.rates) {
                client.query({
                    text: 'INSERT INTO currency(date, eur, jpy, rub) VALUES($1, $2, $3, $4)',
                    values: [day.slice(0,10), res.rates[day].EUR, res.rates[day].JPY, res.rates[day].RUB]
                }, (err,res)=>console.log(res))
            } 
        }else{
            console.log(res.error.message);
        } 
    })
    .catch((e)=>console.log(e))
}

let rate = {

    get_all(course_date){
        return new Promise((resolve,reject)=>{
            client.query(`SELECT * FROM day_course WHERE date ='${course_date}'`, (err,res) => {
                resolve(res.rows)
            })
        })
    },

    get_pair(req){
        return new Promise((resolve,reject)=>{
           
            client.query(`SELECT ${req.currency1},${req.currency2} FROM day_course WHERE date ='${today_full_date()}'`, (err,res) => {
                for (const [key, val] of Object.entries(res.rows[0])) {
                    if (val==null && key=='usd') res.rows[0].usd=1
                }
                let currencys = Object.values(res.rows[0])
                resolve(currencys[0]/currencys[1])
            })
        })
    },

    log(type){
        client.query({    text: 'INSERT INTO log(date, type) VALUES($1, $2)',
                      values: [today_full_date(), type]
                 }, (err,res)=>{ if(err) console.log(err) })
    },

    init(){
            
        client.query(`CREATE TABLE IF NOT EXISTS day_course (
            date TEXT primary key,
            usd real,
            eur real,
            jpy real,
            rub real)`)
        
        client.query(`CREATE TABLE IF NOT EXISTS log (
            date TEXT ,
            type TEXT )`)
        
        // client.query(`SELECT * FROM day_course`, (err,res)=>{
        //     if(res.rowCount == 0) fist_write()
        // })

        check()                                                             
            
    
        timer()                                                             
    }
}


module.exports.rate = rate