function doGet(e) {
  let action = e.parameter.action;
  let template = HtmlService.createTemplateFromFile("index");
  return template.evaluate();

}

// Constants
const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';


// Generate a question from OpenAI API
function generateJapaneseQuestion() {
  const messages = [{
      role: 'user',
      content: `
      You are an English teacher of junior high school in Japan.
        Create a 10 Japanese to English single sentense translation questions for a student on following conditions.
        1. For all questions, use a junior high school level verb+preposition. examples: "get over", "hand in", "look after"
        
        2. use at least one of the following gramatical aspect. 
        2.1. 時制（未来形、過去形、現在分詞、過去分詞、現在進行形）
        2.2. 第４文型もしくは第５文型（SVOO or SVOC）
        2.3. 受動態
        2.4. 助動詞
        2.5. 関係代名詞
        2.6. 比較級、最上級
        
        3. avoid using same words and grammar as much as possible.
   
        4. As a hint, add short grammatical explanation and the idiom.

        result must be strict JSON format like follorowing example.
        [
          {
            "Japanese": "あなたに会えるのを楽しみにしています",
            "hint": "現在進行形で。look forward to(楽しみにする)",
            "English":"I'm looking forward to meeting you."
          }, ...
        ]`
  }];
  let generateds = callOpenAI(messages);
  return generateds.concat(getRandomRows());
}

function test(){
  //let questions = generateJapaneseQuestion();
  //Logger.log(questions);

  let score = scoreTranslation("彼らは山でキャンプをしています", "They are camping on mountains")
  Logger.log(score);
}

// Score translation using OpenAI API
function scoreTranslation(japaneseText, englishTranslation, rowNumber) {
  const messages = [
    {
      role: 'user',
      content: `
      You are an English teacher of junior high school in Japane.
      Evaluate following english translation of the japanese text and give it a score(0-10).
      Give the most natural translation.
      Moreover explain your evaluation explained in Japanese.

      Japanese text: [${japaneseText}]

      Student's translation: [${englishTranslation}]

      your answer should be strictly JSON format as follows.
      {
        "score": 10,
        "description": "Your evaluation in Japanese",
        "correct": "Most natural English translation."
      }
      `
    }
  ];
  let score = callOpenAI(messages);
  saveScore(japaneseText, englishTranslation, score['score'], rowNumber)
  return score;
}

// Centralized function to interact with OpenAI API
function callOpenAI(messages) {
  const options = {
    'method': 'post',
    'headers': {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      messages: messages
    }),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(API_ENDPOINT, options);
  if (response.getResponseCode() !== 200) {
    Logger.log(response.getContentText());
    throw new Error(`Failed to fetch. Response code: ${response.getResponseCode()} ${response.getContentText()}`);
  }
  const responseData = JSON.parse(response.getContentText());
  try{
    return JSON.parse(responseData.choices[0].message.content.trim());
  } catch(e){
    throw new Error(`NOT JSON ANSWER ${responseData.choices[0].content}`);
  }
}

// Append to Google Spreadsheet
function saveScore(question, translation, score, rowNumber) {
  let spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
  let sheet = spreadsheet.getSheets()[0];

  if (rowNumber) {
    // Update the existing row
    let range = sheet.getRange(rowNumber, 1, 1, 4); // Update all 4 columns
    range.setValues([[new Date(), question, translation, score]]);
  } else {
    // Append a new row if no rowNumber is provided
    sheet.appendRow([new Date(), question, translation, score]);
  }
}


// Retrieve random 5 rows based on conditions
function getRandomRows() {
  var spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
  var values = spreadsheet.getSheets()[0].getDataRange().getValues();
  values = values.slice(1).map( (r, i) => {let _r = Array.from(r); _r.push(i+2); return _r;});

  var currentDate = new Date();
  var twoWeeksAgo = new Date(currentDate.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  var filteredRows = values.filter(function(row) {
    var rowDate = new Date(row[0]);
    var score = row[2];
    return (rowDate < twoWeeksAgo) && (score < 9);
  });
  
  var selectedRows = [];
  for (var i = 0; i < 5 && filteredRows.length > 0; i++) {
    var randomIndex = Math.floor(Math.random() * filteredRows.length);
    selectedRows.push(filteredRows[randomIndex]);
    filteredRows.splice(randomIndex, 1);
  }

  return selectedRows.map( row => {
    return {'Japanese': row[1], 'hint': `${row[0]}に出題`, 'Row':row[3]};
  });
}
