var mysql  = require('mysql');
var config = require('./config.json');
let date = require('date-and-time');

var connection = mysql.createConnection({
      host     : config.dbhost,
      user     : config.dbuser,
      password : config.dbpassword,
      database : config.dbname
    });
//table for occupancy (for each 30 min on the intervalle needed)
var t =[];

function max(date1, date2) {
    let diff = date.subtract(date1, date2).toMinutes();
    if(diff > 0){return date1;} else {return date2;}
}

function min(date1, date2) {
    let diff = date.subtract(date1, date2).toMinutes();
    if(diff < 0){return date1;}else{return date2;}
}

var mysqlDateTimeFormat = 'YYYY-MM-DD HH:mm:ss';
function fm(d) {
    return date.format(d, mysqlDateTimeFormat);
}




exports.handler= (event,context,callback) =>{
    
    context.callbackWaitsForEmptyEventLoop = false ;
    
    
    
    // our functions 
    var  intervalSize = function (start,end){
        let size = (date.subtract(start, end).toMinutes())/30;
        return size;
    }

    var initTable = function (size){
        t = [];
        for(var i = 0 ; i<size;i++){
            t.push(0);
        }
    }

    //updating the table occupancy
    var upDateTable = function (from,to){
        for(var i=from;i<to;i++){
            t[i]=t[i]+1;
        }
    }

var Nprice;
var NnbrPlaceInZone;

 //get zone info (price and nbr place globale)
var spotinfo = `select price,zoneplace from zone where parkid = ? and zoneid = ?`;
connection.query(spotinfo, [event.parkId , event.zoneId ], function (error, resultskk, fields) {
    if (error){ callback("somthing wrong");}
    else{
        NnbrPlaceInZone = resultskk[0].zoneplace;
        Nprice = resultskk[0].price;
        console.log("results = "+JSON.stringify(resultskk) );
        console.log("price = "+Nprice);
        console.log("nbr place = "+NnbrPlaceInZone);
    }
    
});


var checkDes = function (nbrP){
    for(var i=0 ; i<t.length ; i++){
        if(t[i] === nbrP){
            return false;
        }
    }
    return true;
}

    

    
    //parsing the string from the input data
    var S = date.parse(event.startT, 'YYYY/MM/DD HH:mm:ss');
    var E = date.parse(event.endT  , 'YYYY/MM/DD HH:mm:ss');
    //formating the date object to add and query the database (with respecting the database date format)
    var S_Formated = date.format(S, mysqlDateTimeFormat);
    var E_Formated = date.format(E, mysqlDateTimeFormat);
    
    var sql = `SELECT * FROM reservation where startTime < ? and endTime > ? and zoneid = ? and parkid = ?`; 
    
    connection.query(sql, [E_Formated, S_Formated ,event.zoneId ,event.parkId ], function (error, results, fields) {
    if (error){ callback("somthing wrong");}
    else{
        initTable(intervalSize(E,S));
        
        results.forEach(function (reservation){
            var star = (date.subtract( max(reservation.startTime,S), S).toMinutes())/30 ;
            var end = ((date.subtract( min(reservation.endTime,E),max(reservation.startTime,S) ).toMinutes())/30) + star ;
            upDateTable(star,end);
        });

        //calling the checkDes() function (false : mean nbr of place for your zone = nbr occupent interval) 
        let what = checkDes(NnbrPlaceInZone);
          if(!what){
            let respons ={
                "Availability"  : false,
                "Reservation"   : false,
                "Message "      :"sorry spot not Availabile Any More Now !!"
            }
                callback(null,respons) ;
            }else{

                // adding the reservation to your database 
                var addreservation = `INSERT INTO reservation (startTime, endTime, zoneid,parkid) VALUES (?, ?, ?, ?)`;
                connection.query(addreservation, [E_Formated, S_Formated ,event.zoneId ,event.parkId ], function (error, results, fields) {
                    if (error){ callback("Somthing Wrong");}
                    else{
                        let respons ={
                            "Reservation": true,
                            "price"      : "$ "+Nprice,
                            "Zone_ID"    : event.zoneId,
                            "Park_ID"    : event.parkId,
                            "Map_Link"   : "http!//........"
                        }
                    }
                });
                callback(null,respons) ;
            }
        }
              
    });
}