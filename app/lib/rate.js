const https = require('https')
const { Sequelize, Model, DataTypes } = require('sequelize')

const sequelize = new Sequelize("currency", process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
    dialect: 'postgres',
    host: 'data_base',
    port: '5432'
})

let today_full_date = function() {
    let today  = new Date(Date.now())
    return `${today.getDate() <10 ? 0 : ''}${today.getDate()}-${today.getMonth()+1 <10 ? 0 : ''}${today.getMonth()+1}-${today.getFullYear()}`

}

class Day_course extends Model {}
Day_course.init({
    date: {
        type: DataTypes.STRING,
        allowNull: false
    },
    usd: {
        type: DataTypes.REAL
    },
    eur: {
        type: DataTypes.REAL,
        allowNull: false
    },
    jpy: {
        type: DataTypes.REAL,
        allowNull: false
    },
    rub: {
        type: DataTypes.REAL,
        allowNull: false
    }


}, { sequelize, modelName: 'day_course' })

class Log extends Model {}
Log.init({
    date: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false
    }
},{ sequelize, modelName: 'log' })





class DB extends Day_course {
    
    currency_api = process.env.CURRENCYFREAKS_API_KEY;
    url = `https://api.currencyfreaks.com/latest?apikey=${this.currency_api}&symbols=USD,EUR,JPY,RUB`;

    static currency_request() {
        return new Promise((resolve, reject) => {
            https.get(url, (res) =>{
                let data = ''
                res.on('data',  chunk => data += chunk )
                res.on('end',   () => {
                    const parseData = JSON.parse(data)
                    resolve(parseData)
                })
                res.on('error', e => reject(e))
            })
        })
    }

    static push() {
        this.currency_request(this.url)
        .then((res) => Day_course.create({ date: today_full_date(), eur: res.rates.EUR, jpy: res.rates.JPY, rub: res.rates.RUB }) )
    }

    static async check_today() {
        
        let result = await Day_course.findOne({ where: { date:today_full_date()}})                //проверка записи на текущую дату
        if(result === null) this.push()  
    }

    static timer() {                                                                             //обновление и запись в БД курса валют в назначенное время
        let today  = new Date(Date.now())
        let clock = 12
        let timeout = ((1000*3600*24)-(today.getMilliseconds()+((today.getSeconds()*1000)+(today.getMinutes()*60*1000)+(today.getHours()*3600*1000))))-((1000*3600*24)-(1000*3600*clock))
        if(Math.sign(timeout)==-1) timeout = (1000*3600*24)+timeout
        let interval = 1000*3600*24
        let update_query = () => {
            currency_request(url)
            .then((res) => Day_course.update({ eur: res.rates.EUR, jpy: res.rates.JPY, rub: res.rates.RUB }, {
                where: {
                    date: today_full_date()
                }
            }))
        }
        setInterval(this.check_today, 1000*3600);
        let update = function () {
            update_query()
            setInterval(update_query,interval)
        }
        setTimeout(update, timeout);   
    }
    
    static get_pair(req) {
        return new Promise(async (resolve,reject)=>{
           const result = await Day_course.findOne({
               where: {
                   date: today_full_date()
               }
           })
           result[0].usd = 1
           resolve(result[0][req.currency1]/result[0][req.currency2])
        })
    }

    static fist_write() {
        let five_day_earler = new Date(Date.now() - 1000*3600*24*5)
        let last_five_day_url = `https://api.currencyfreaks.com/timeseries?apikey=${currency_api}&start_date=${five_day_earler.getFullYear()}-${five_day_earler.getMonth()+1 < 10 ? 0 : ''}${five_day_earler.getMonth()+1}-${five_day_earler.getDate()}&end_date=${today.getFullYear()}-${today.getMonth()+1 < 10 ? 0 : ''}${today.getMonth()+1}-${today.getDate()}&base=USD&symbols=EUR,JPY,RUB`
        currency_request(last_five_day_url)
        .then((res)=>{
            if(res.success){
                for (const day of res.rates) {
                    Day_course.create({ date: day.slice(0,10), eur: res.rates[day].EUR, jpy: res.rates[day].JPY, rub: res.rates[day].RUB})
                } 
            }else{
                console.log(res.error.message);
            } 
        })
        .catch((e)=>console.log(e))
    }

    static start() {
        sequelize.sync()
        .then(console.log)
        .catch(console.log)
        // const check_first = await Day_course.findAll()
        // if(check_first === null) this.fist_write()
        this.check_today()
        this.timer()                                                             
    }

    static log(type){
        Log.create({ date: today_full_date(), type: type })
    }
}


module.exports.DB = DB