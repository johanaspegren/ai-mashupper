const functions = require("firebase-functions");
const express = require('express');
const engines = require('consolidate');
const exphbs = require('express-handlebars');
const app = express();

// to keep API hidden in .env
const env = require("dotenv").config();
console.log(env)

// OpenAI START
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
console.log('INIT OpenAI')

//app.engine('hbs',engines.handlebars);
app.engine('hbs', exphbs.engine({
    defaultLayout: 'index',
    extname: '.hbs'
}));

app.set('views','./views');
app.set('view engine','hbs');

// serve html
app.get('/', function (req, res) {
    console.log('receive GET req.body = %s', req.body)
    console.log('hej svejs från index (lilla)')
    let greeting = {hi:'Hej'}
    let result = {show:true}

    let ideas = [
        {description:'idea1', imgUrl:'../images/bg_tv_2023.jpg'},
        {description:'idea2', imgUrl:'../images/bg_tv_2023.jpg'},
        {description:'idea3', imgUrl:'../images/bg_tv_2023.jpg'}
    ]

    res.render('ideas', {
        result: {
            show :   false,
            prompt:  "prompt",
            ideas:   ideas
        }
    });
})

//exports.app = functions.https.onRequest(app);
exports.app = functions.runWith({ memory: '2GB', timeoutSeconds: 360 }).https.onRequest(app);


app.post('/mash', async function(req,res){
    console.log('receive POST req.body = %s', req.body)
    let mashedUpped = ""
    var prompt = validatePrompt(req.body)
    mashedUpped = await mashUpped(prompt);
    let ideas = cleanupResponse(mashedUpped.text)

    console.log('ideas = %s', ideas)
    let imgUrls = []
    ideas.forEach(idea =>{
        let heading = getHeading(idea)
        let imgUrl = generateImage(idea)
        imgUrl.then(function(result){
            console.log('img_url =%s', result)
            imgUrls.push(result)
            if(imgUrls.length ==  3){
                //update
                let is = [
                    {heading:getHeading(ideas[0]).heading, description:getHeading(ideas[0]).descr, imgUrl:imgUrls[0]},
                    {heading:getHeading(ideas[1]).heading, description:getHeading(ideas[1]).descr, imgUrl:imgUrls[1]},
                    {heading:getHeading(ideas[2]).heading, description:getHeading(ideas[2]).descr, imgUrl:imgUrls[2]}
                ]
                drawPage(res, prompt, is)
            }            
        })
    })
});

function getHeading(input){
    let result = input.match(/^([0-9]).\s*(.+):(.+)/);
    let index = result[1]
    let heading = result[2]
    let descr = result[3]
    return {index:index, heading:heading, descr:descr}
    
}


function drawPage(res, prompt, ideas){
    console.log('drawPage, ideas : %s ', ideas)
    
    res.render('ideas', {
        result: {
            show :   true,
            prompt:  prompt,
            ideas:   ideas
        }
    });

}


// -----------------------
function cleanupResponse(_text){
    console.log('cleanupResponse = %s', _text)
    let temp = _text.split('\n')
    let ideas = []
    console.log(temp.length)
    temp.forEach(t => {
        if(t != '') {
            console.log('t = %s', t) 
            ideas.push(t)
        }
    });
    return ideas
}


// get the challenge and the ingredients from the form submission fields
function validatePrompt(_in) {
    console.log("validate this : %s", _in)
    if (typeof _in === 'undefined') return

    let challenge = _in.challenge

    let etIngredients = getField(_in.emergingTech)
    let esIngredients = getField(_in.existingServices)
    let rgIngredients = getField(_in.rGroup)
    console.log(typeof etIngredients)
    console.log(typeof esIngredients)
    console.log(typeof rgIngredients)

    let ingredients = ""
    if(etIngredients) ingredients = etIngredients
    if(esIngredients) ingredients = ingredients + ',' + esIngredients
    if(rgIngredients) ingredients = ingredients + ',' + rgIngredients
    console.log("ingredients:%s", ingredients)
    
    // remove undefined
    ingredients = ingredients.replace(/undefined/g, '')
    ingredients = ingredients.replace(/,([^,]*)$/, ' and ' + '$1')
    ingredients = ingredients.replace(',', ', ')

    console.log("ingredients:%s", ingredients)

    let out = "Create a list of three innovative solutions to " 
            + challenge + " using " + ingredients
    console.log("out : %s", out)
    return out
}

function getField(_in){
    if(typeof _in === undefined) return ""
    if(Array.isArray(_in)){
        return _in.toString()
    }
    return _in
}

// prepare and make the call to openAI
async function mashUpped(_prompt){
    if(!_prompt) return

    const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: _prompt,
        temperature: 0.6,
        max_tokens: 600,
      });

    console.log("==========")
    console.log(response.data)
    console.log("OKOKOKOK")
    return response.data.choices[0]
}

// prepare and make the call to openAI
async function generateImage(_prompt){
    if(!_prompt) return

    const response = await openai.createImage({
        prompt: _prompt,
        n: 1,
        size: "256x256",
    });
    image_url = response.data.data[0].url;
    return image_url
}  
// OpenAI END