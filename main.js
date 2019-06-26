const uid = require('uid-safe').sync;
const _ = require('lodash');
const fs = require('fs');
var kuromoji = require("kuromoji");
const NUMBER_RUN_FILE = 2;
const YEAR = 365;
const SEC = 86400000;
const JUMP_TIME = 60;
const INPUT ='input';
const OUTPUT = 'output';
const QUESTION = 'question';
const pad = (n) => ('0' + (n)).slice(-2);
const fmt = (now) => `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
const pathFile = `${INPUT}/EdmBzb6EOrnCLxcpB6YCLBYwgJhHBcso.json`;
const questionTEXT = `${QUESTION}/input.txt`;
///
module.exports = {};
function readFileJsonQuestion(){
  const isExistFileTEXT = fs.existsSync(questionTEXT);
  let fileContent ;
  if(isExistFileTEXT){
    fileContent = fs.readFileSync(questionTEXT, 'utf8').split('\r\n');
  }
  return fileContent;
}
function writeFileSyn(listDayAnalytis,listKeyword,question,day){
  var y;
  for(y = 0 ; y < listDayAnalytis.length; y+= 1){
    const day = listDayAnalytis[y];
    var i = 1;
    while (i <= NUMBER_RUN_FILE){
      const chatId = uid(24);
      const dataPathNew = `${OUTPUT}/${day}/${chatId}.json`;
      const isExistFile = fs.existsSync(dataPathNew);
      if (!isExistFile) {
        try {
          const fileContent = updateFile(pathFile,chatId,listKeyword,question);
          fs.writeFileSync(dataPathNew, JSON.stringify(fileContent), 'utf8');
        } catch (e) {
          console.log(e.message);
        } finally{
        }
      }
      i++; // tăng i lên nếu không sẽ bị lặp vô hạn
    }
  } 
}
function createFileJsonToData(){
  readFileJsonQuestion();
  // tạo danh sách ngày tháng
  let listDayAnalytis =[];
  for(var d = 1; d < YEAR; d+=1){
      const oneYearAgoTime = (new Date()).getTime() - (SEC * (d));
      const oneYearAgo = fmt(new Date(oneYearAgoTime));
    listDayAnalytis.push(oneYearAgo);
  }
  // tạo thư mục
  _.forEach(listDayAnalytis,day=>{
       makeDirFullPath(day) 
  })
  // Tạo thư viện phân tích từ
      kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build(function (err, tokenizer) {    
      // tokenizer is ready
            const listQuestion = _.values(readFileJsonQuestion());
            const indexQuestion = Math.floor((Math.random() * listQuestion.length) + 1);
            const question = listQuestion[indexQuestion];
            const tokens = tokenizer.tokenize(question);
            const listKeyword =
            _.chain(tokens)
            // 一般名詞・固有名詞にフラグをつける
            .map(token => {
              token.is_noun =
                token && token.pos === '名詞'
                && (token.pos_detail_1 === '一般' || token.pos_detail_1 === '固有名詞' || token.pos_detail_1 === 'サ変接続')
              if (token.basic_form === '*') token.basic_form = token.surface_form;
              return token
            })
            // 名詞句にする
            .reduce((tokens, current) => {
              const prev = _.last(tokens);
              // 「とは」対応
              if (prev && prev.basic_form == 'と' && current.basic_form == 'は') {
                tokens.pop();
                current = { pos:'名詞句', pos_detail_1:'自立', basic_form:'とは', is_noun:true }
              }
              // 「何時」対応
              if (prev && prev.basic_form.length <= 2 && prev.basic_form !== '*' && current.pos === '名詞' && current.pos_detail_1 === '接尾') {
                tokens.pop();
                prev.basic_form += current.basic_form;
                current = prev;
              }
              // 名詞の一般・固有名詞が連続する場合、それらを連結したものもキーワードとする
              if (prev && prev.is_noun && current.is_noun) {
                const nouns = [];
                const compounds = []
                _.forEachRight(tokens, token => {
                  if (!token.is_noun) return false; // 名詞以外でストップ
                  nouns.unshift(tokens.pop());      // 最後の名詞を取り除く
                  if (_.endsWith(token.basic_form, prev.basic_form)) { // 直前の名詞から名詞句を生成する
                    compounds.unshift(Object.assign({}, token, { compounds:true, basic_form: token.basic_form + current.basic_form }));
                  } else if (token.compounds) {     // 名詞句だったら先頭に
                    compounds.unshift(nouns.pop())
                  }
                })
                tokens.push(...compounds, ...nouns);
              }
              tokens.push(current)
              return tokens;
            }, [])
            // 長い名詞の分割
            .flatMap(token => {
              if (!token.is_noun || token.compounds ) return [token];
              const words = splitWord((token.basic_form === '*') ? token.surface_form : token.basic_form);
              return [token].concat(words.map(word => Object.assign({}, token, { basic_form:word })))
            })
            // 記号は除く
            .filter(value => ! (value.surface_form && value.surface_form.match(/[ -/:-@\[-`{-~]+/)))
            // 助詞は覗く
            .filter(value => _.indexOf(['助詞', '助動詞', '記号', '接頭詞'], value.pos) === -1)
            // iOS版の「版」のような名詞はノイズになるので除外
            .filter(value => _.indexOf(['接尾', '非自立'], value.pos_detail_1) === -1)
            // 動詞の活用語尾の除去
            .map(value => {
              if (value.pos === '動詞' && Math.max(value.basic_form.length, value.reading.length) > 2) {
                value.basic_form = value.basic_form.replace(/する$/, '');
              }
              return value;
            })
            // 語彙の抽出
            .map(value => (value.basic_form === '*') ? value.surface_form : value.basic_form)
            // マッチ度を上げるために末尾の長音は削除
            .map(keyword => keyword.length <= 3 ? keyword : keyword.replace(/ー$/, ''))
            // 重複キーワードの除去
            .uniq()
            // ストップワードの除去
            .filter(x => x)
            .value();
            writeFileSyn(listDayAnalytis,listKeyword,question);
  });
}
function updateFile(pathFile,chatId,listKeyword,question){
    const strFileData = fs.readFileSync(pathFile, 'utf8');
    if (!strFileData) {
      return;
    }
    const dataFile = JSON.parse(strFileData);
    _.forEach(dataFile, (log, index) => {
      if (!log) return;
      const message = log.message;
      // cập nhật lại chatId
      if(message.chatId) {message.chatId = chatId}
      // get timestamp
      let oneYearAgoTime = (new Date()).getTime() - (SEC * (YEAR));
      // get day
      let oneYearAgo = fmt(new Date(oneYearAgoTime));
      // Cập nhật lại timestamp
      if(log.time){
        log.time = oneYearAgoTime + JUMP_TIME;
      }
      // Cập nhật lại id
        if(message.id){
          message.id = chatId + '-' + log.time + '-'+ index;
        }
      // Cập nhật lại rooms
      if(message.room) {message.room = chatId;}
      if(message.rooms){
      message.rooms =  _.mapKeys(message.rooms, function(index) {
        message.rooms = new Object({[chatId]: index});
        });
      }
      if(message.chatId && message.tenantId && message.contents[0].unusedKeywords){
        message.contents[0].unusedKeywords = listKeyword;
      }
      if(message.text){
        message.text= question
      }
   })
   return dataFile;
}
function splitWord(word) {
  // 3文字程度の場合はこれ以上分割しない
  if (this.tokenizer === undefined || word.length <= 3) {
    return [];
  }

  // 辞書として登録されている単語を取得
  const lattice = this.tokenizer.getLattice(word);
  const nodes = _.flatMap(lattice.nodes_end_at, nodes => {
    return _.filter(nodes, node => node.type === 'KNOWN' && node.length >= 2 && node.surface_form !== word);
  });

  // 先頭から連続して分割されているところを探す
  const cont = _.findLastIndex(nodes, (node, idx) =>
    (idx === 0 && node.start_pos == 1)
    || (idx > 0 && nodes[idx - 1].start_pos + nodes[idx - 1].length === node.start_pos)
  );
  const head = nodes.slice(0, cont + 1);

  // 開始位置が同じ場合は長い単語を優先する
  head.sort((n1, n2) => n1.start_pos - n2.start_pos || n2.length - n1.length);
  const head2 = _.filter(head, (node, idx, nodes) =>
    idx === 0 || nodes[idx - 1].start_pos !== node.start_pos
  );

  // 重複は削除
  const words = _.uniq(_.map(head2, node => node.surface_form));

  // 残った部分も単語として残す
  // const result = cont + 1 === nodes.length ? words : words.concat([word.substr(words.join('').length)]);
  // console.log(nodes, cont, head);
  return words;
}
function makeDirFullPath (day) {
  const dirPath = `${OUTPUT}/${day}`;

  // make directories one by one
  let listDirs = dirPath.split('/');

  let fullPath = '';
  listDirs.forEach((path) => {
    if (fullPath === '') {
      fullPath = path;
    } else {
      fullPath = fullPath + '/' + path;
    }
    // If fullPath is not exist, then make directory correspond to fullpath
    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath);
      } catch (e) {
        if (e.code !== 'EEXIST') {
          console.log(e.message);
          return
        }
      }
    }
  });
  return;
}
  Object.assign(module.exports, {
    createFileJsonToData
  });