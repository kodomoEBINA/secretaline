/*
列番号と列名
1:項番
2:内容
3:期限（日）
4:期限（時）
5:ステータス
6:完了日
7:メモ

改善したいこと
// ・日付バリデーション＆としまたぎ処理（4/5）
・すでに登録されています（4/5）
・Replyの一括化（GW）
・エラー処理の一括化（GW)
・ヘルプ機能（4/5）
・したこと機能
・アーカイブ機能（GW）
・検索機能
・LineCloverから使えるようにする
・リッチメニュー検証 （GW）
・削除コマンド

*/

var tmplId = '1zjKouzDTc1Zl4ExglDenfCzCvlxt5VX2pkLtEb6Gm4M';
var tmpl = DriveApp.getFileById(tmplId);

var ACCESS_TOKEN = 'dbQYyWBMvTH+Bex1WtBu1puhbsSQXxOQZ3/+oqN5tom9y33KODbfzLsTR9C3yNHAhvHFBaqokTebrPhsfDIrtIf6NSDSUuBV9IBIUYyhsFeTujb0LXJj0r1PipV8WH0uR4TC+CvEo0+IBYxpLetz3wdB04t89/1O/w1cDnyilFU=';
var url = 'https://api.line.me/v2/bot/message/reply'; // 応答メッセージ用のAPI URL

//Firebaseへの接続用定義
var token = ScriptApp.getOAuthToken();
var fb = FirebaseApp.getDatabaseByUrl("https://secretaline-c7a46.firebaseio.com/", token);

//エラー判定用
var errflg = 0;

//変更処理判定用
var changeflg = 'status';

// 範囲指定
var degree = 'all';

var today = new Date();
var year = today.getFullYear();
var month = today.getMonth() + 1;
var date = today.getDate();

var monthlist1 = [1, 3, 5, 7, 8, 10, 12]
var monthlist2 = [4, 6, 9, 11]


//Linebotがメッセージを受け取った時の処理
function doPost(e) {
    //メッセージ内容を変数に代入
    var events = JSON.parse(e.postData.contents).events[0];

    //ユーザIDを抽出
    var userId = events.source.userId;

    //メッセージ内容から本文のみを抽出
    var userMessage = JSON.parse(e.postData.contents).events[0].message.text;

    //スペースで区切って配列化
    var messageList = userMessage.split(/\s|　/);

    if (messageList[0] == '登録') { //登録処理
        var Name = fb.getData('user/' + userId + '/name');
        if (Name == undefined) {
            if (messageList[1] == undefined) {
                replyErrorMessage(e);
            } else {
                Name = messageList[1];
                userReg(e, userId, Name);
                errflg = 0;
            }
        } else {
            replyRegistered(e);
        }
    } else { //登録処理でなければ、後続のために変数を色々代入
        var SSid = fb.getData('user/' + userId + '/id');
        var sheet = SpreadsheetApp.openById(SSid).getSheetByName('TodoList');

        if (messageList[0].match(/#\d{1,3}/) !== null) {

            if (messageList[0].search(/\d{3}/) !== -1) {
                var index = messageList[0].search(/\d{3}/);
                var num = Number(messageList[0].substring(index, index + 3));
            } else if (messageList[0].search(/\d{2}/) !== -1) {
                var index = messageList[0].search(/\d{2}/);
                var num = Number(messageList[0].substring(index, index + 2));
            } else if (messageList[0].search(/\d{1}/) !== -1) {
                var index = messageList[0].search(/\d{1}/);
                var num = Number(messageList[0].substring(index, index + 1));
            } else {
                replyErrorMessage(e);
                errflg = 1;
            }


            if (messageList[1] == undefined) {
                replyOneTask(e, num, SSid);
            } else if (messageList[1] == 'なう') { //ステータス変更処理
                sheet.getRange(num + 1, 5).setValue('対応中');
            } else if (messageList[1] == 'だん') {
                sheet.getRange(num + 1, 5).setValue('完了');
                sheet.getRange(num + 1, 6).setValue(year + '/' + month + '/' + date);
            } else if (messageList[1] == '不要') {
                sheet.getRange(num + 1, 5).setValue('不要');
            } else if (messageList[1].match(/\d{1,2}\/\d{1,2}/) !== null) { //期限修正処理
                if (dateValidate(messageList[1]) == 0) {
                    var subMessageList = messageList[1].split('/');
                    var inputmonth = Number(subMessageList[0]);
                    var inputday = Number(subMessageList[1]);
                    var inputdate = new Date(year, inputmonth, inputday);
                    if (today < inputdate) {
                        sheet.getRange(num + 1, 3).setValue(year + '/' + messageList[1]);
                    } else {
                        sheet.getRange(num + 1, 3).setValue((year + 1) + '/' + messageList[1]);
                    }
                    changeflg = 'deadline';
                } else {
                    replyErrorMessage(e);
                    errflg = 1;
                }
            } else if (messageList[1] == '変更') { //内容変更機能
                if (messageList[2] == undefined) {
                    replyErrorMessage(e);
                    errflg = 1;
                } else {
                    sheet.getRange(num + 1, 2).setValue(messageList[2]);
                    changeflg = 'task';
                }
            } else {
                replyErrorMessage(e);
                errflg = 1;
            }

            if (errflg == 0) {
                replyUpdate(e, num, changeflg, SSid);
            }

        } else if (messageList[0] == '今日') {
            var degree = 'today';
            replyTask(e, degree, SSid);
        } else if (messageList[0] == 'やること') {
            var degree = 'all';
            replyTask(e, degree, SSid);
        } else if (messageList[0] == 'URL' || messageList[0] == 'url' || messageList[0] == 'Url') { //URLを教える
            var flg = 0;
            replyURL(e, userId, flg);
        } else {
            var columnBVals = sheet.getRange('B:B').getValues(); // B列の値を配列で取得
            var lastRow = columnBVals.filter(String).length; //空白を除き、配列の数を取得

            if (messageList[1] == undefined) {
                sheet.getRange(lastRow + 1, 3).setValue(year + '/' + month + '/' + date);
            } else if (messageList[1].match(/\d{1,2}\/\d{1,2}/) !== null) {
                if (dateValidate(messageList[1]) == 0) {
                    var subMessageList = messageList[1].split('/');
                    var inputmonth = Number(subMessageList[0]);
                    var inputday = Number(subMessageList[1]);
                    var inputdate = new Date(year, inputmonth, inputday);
                    if (today < inputdate) {
                        sheet.getRange(lastRow + 1, 3).setValue(year + '/' + messageList[1]);
                    } else {
                        sheet.getRange(lastRow + 1, 3).setValue((year + 1) + '/' + messageList[1]);
                    }

                } else {
                    errflg = 1;
                }

            } else {
                errflg = 1;
            }

            if (errflg == 1) {
                replyErrorMessage(e);
            } else {
                sheet.getRange(lastRow + 1, 1).setValue(lastRow);
                sheet.getRange(lastRow + 1, 2).setValue(messageList[0]);
                sheet.getRange(lastRow + 1, 5).setValue('未着手');

                if (messageList[2] !== undefined) {
                    sheet.getRange(lastRow + 1, 7).setValue(messageList[2]);
                }

                replyTaskReg(e);

            }


        }

    }

};


function userReg(e, userId, Name) {
    fb.setData('user/' + userId + '/name', Name);
    // var SSid = SpreadsheetApp.create(Name + '(' + userId + ')').getId();
    var SSid = tmpl.makeCopy(Name + '(' + userId + ')').getId();
    var File = DriveApp.getFileById(SSid);
    File.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.EDIT);
    fb.setData('user/' + userId + '/id', SSid);
    var flg = 1;

    replyURL(e, userId, flg);

};

function replyURL(e, userId, flg) {
    var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;
    var id = fb.getData('user/' + userId + '/id');
    var ContentText = '';

    if (flg == 1) {
        var Name = fb.getData('user/' + userId + '/name');
        ContentText = Name + 'を登録しました。\n↓↓↓\n'
    }

    UrlFetchApp.fetch(url, {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            Authorization: 'Bearer ' + ACCESS_TOKEN
        },
        method: 'post',
        payload: JSON.stringify({
            replyToken: replyToken,
            messages: [{
                type: 'text',
                text: ContentText + 'https://docs.google.com/spreadsheets/d/' + id + '/edit?usp=sharing'
            }]
        })
    });
};

function replyUpdate(e, num, changeflg, SSid) {
    var sheet = SpreadsheetApp.openById(SSid).getSheetByName('TodoList');
    var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;
    var GL = [];
    var cnt = 0;
    var ContentText;
    ContentText = '';

    // 更新対象の目標だけを記入する
    GL[cnt, 0] = sheet.getRange(num + 1, 1).getValue();
    GL[cnt, 1] = sheet.getRange(num + 1, 2).getValue();
    if (changeflg == 'status') {
        GL[cnt, 2] = sheet.getRange(num + 1, 5).getValue();
        ContentText = ContentText + '\n↓↓↓\n' + '#' + GL[cnt, 0] + ' ' + GL[cnt, 1] + ' ' + GL[cnt, 2];
    } else if (changeflg == 'deadline') {
        GL[cnt, 2] = sheet.getRange(num + 1, 3).getValue();
        GL[cnt, 2] = Utilities.formatDate(GL[cnt, 2], "JST", "yyyy/MM/dd");
        ContentText = ContentText + '\n↓↓↓\n' + '#' + GL[cnt, 0] + ' ' + GL[cnt, 1] + '\n期限：' + GL[cnt, 2]; //日付のフォーマット
    } else if (changeflg == 'task') {
        ContentText = ContentText + '\n↓↓↓\n' + '#' + GL[cnt, 0] + ' ' + GL[cnt, 1];
    }


    //抽出した目標の内容を返信する
    UrlFetchApp.fetch(url, {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            Authorization: 'Bearer ' + ACCESS_TOKEN
        },
        method: 'post',
        payload: JSON.stringify({
            replyToken: replyToken,
            messages: [{
                type: 'text',
                text: '#' + num + 'を更新しました。' + ContentText
            }]
        })
    });
};

function replyTask(e, degree, SSid) {
    var sheet = SpreadsheetApp.openById(SSid).getSheetByName('TodoList');
    var columnBVals = sheet.getRange('B:B').getValues(); // B列の値を配列で取得
    var lastRow = columnBVals.filter(String).length; //空白を除き、配列の数を取得

    //メッセージ内容を変数に代入
    var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;
    var GL = [];
    var cnt = 0;
    var ContentText = '';
    var daytext = '';

    if (degree == 'today') {
        daytext = '今日の';
    }

    for (var i = 2; i <= lastRow; i++) {
        var deadline = sheet.getRange(i, 3).getValue();
        var status = sheet.getRange(i, 5).getValue();

        if (degree == 'all') {
            if (status !== '完了' && status !== '不要') {
                GL[cnt, 0] = sheet.getRange(i, 1).getValue(); //項目番号
                GL[cnt, 1] = sheet.getRange(i, 2).getValue(); //内容
                GL[cnt, 2] = sheet.getRange(i, 3).getValue(); //期限
                GL[cnt, 2] = Utilities.formatDate(GL[cnt, 2], "JST", "yyyy/MM/dd");
                ContentText = ContentText + '\n' + '#' + GL[cnt, 0] + ' ' + GL[cnt, 1] + '\n期限：' + GL[cnt, 2];
            }

        } else if (degree == 'today') {
            if (deadline <= today && status !== '完了' && status !== '不要') {
                GL[cnt, 0] = sheet.getRange(i, 1).getValue(); //項目番号
                GL[cnt, 1] = sheet.getRange(i, 2).getValue(); //内容
                ContentText = ContentText + '\n' + '#' + GL[cnt, 0] + ' ' + GL[cnt, 1]; //日付のフォーマット
            }
        }
        // 未来指定日付のやることを記載するならここに
        cnt++;
    }

    UrlFetchApp.fetch(url, {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            Authorization: 'Bearer ' + ACCESS_TOKEN
        },
        method: 'post',
        payload: JSON.stringify({
            replyToken: replyToken,
            messages: [{
                type: 'text',
                text: daytext + 'やることはこちらです。' + ContentText
            }]
        })
    });
};

function replyOneTask(e, num, SSid) {
    var sheet = SpreadsheetApp.openById(SSid).getSheetByName('TodoList');
    var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;
    var ContentText = sheet.getRange(num + 1, 2).getValue();

    if (ContentText == undefined) {
        replyErrorMessage(e)
    } else {

        UrlFetchApp.fetch(url, {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Authorization: 'Bearer ' + ACCESS_TOKEN
            },
            method: 'post',
            payload: JSON.stringify({
                replyToken: replyToken,
                messages: [{
                    type: 'text',
                    text: ContentText
                }]
            })
        });

    }


}

function replyTaskReg(e) {
    var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;
    UrlFetchApp.fetch(url, {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            Authorization: 'Bearer ' + ACCESS_TOKEN
        },
        method: 'post',
        payload: JSON.stringify({
            replyToken: replyToken,
            messages: [{
                type: 'text',
                text: 'タスクを登録しました。'
            }]
        })
    });
};

function dateValidate(messageList) { //
    var subMessageList = messageList.split('/');
    var inputmonth = Number(subMessageList[0]);
    var inputdate = Number(subMessageList[1]);
    if (inputmonth <= 12) {
        if (inputmonth == 2 && inputdate <= 28) { //閏年対応要
            var errflg = 0;
        } else if (monthlist1.indexOf(inputmonth) !== -1 && inputdate <= 31) {
            var errflg = 0;
        } else if (monthlist2.indexOf(inputmonth) !== -1 && inputdate <= 30) {
            var errflg = 0;
        } else {
            errflg = 1;
        }
    } else {
        errflg = 1;
    }

    if (errflg == 0) {
        return 0;
    } else {
        return 1;
    }
}

function replyErrorMessage(e) {
    var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;

    UrlFetchApp.fetch(url, {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            Authorization: 'Bearer ' + ACCESS_TOKEN
        },
        method: 'post',
        payload: JSON.stringify({
            replyToken: replyToken,
            messages: [{
                type: 'text',
                text: '何か間違えているようです。わからなければ「ヘルプ」と入力してみてください'
            }]
        })
    });
};

function replyRegistered(e) {
    var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;

    UrlFetchApp.fetch(url, {
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            Authorization: 'Bearer ' + ACCESS_TOKEN
        },
        method: 'post',
        payload: JSON.stringify({
            replyToken: replyToken,
            messages: [{
                type: 'text',
                text: 'すでに登録されています'
            }]
        })
    });
};

function test() {
    var SSid = fb.getData('user/' + 'U3315fbfa132ca7a61b4c8b6c4d345dc9' + '/id');
    var sheet = SpreadsheetApp.openById(SSid).getSheetByName('TodoList');
    var columnBVals = sheet.getRange('B:B').getValues(); // B列の値を配列で取得
    var lastRow = columnBVals.filter(String).length;
    Logger.log(lastRow);
}

function test2() {
    var messageList = '2/29';
    var today = new Date();
    var year = today.getFullYear();

    var subMessageList = messageList.split('/');
    var inputmonth = Number(subMessageList[0]);
    var inputdate = Number(subMessageList[1]);


    var inputdate = new Date(year, inputmonth - 1, inputdate);
    if (today > inputdate) {
        Logger.log((year + 1) + '/' + messageList);
    } else {
        Logger.log((year) + '/' + messageList);
    }


}