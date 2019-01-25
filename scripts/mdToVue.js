const fs = require('fs');
var path = require('path');
let { hashElement } = require('folder-hash');
//marked转换工具
let marked = require('marked');
if (!marked) {
    console.log('you need npm i marked -D!');
}

// 基本配置文件信息
let {version} = require("../package.json");
//vue js脚本
//获取所有文件列表
let fileList  = [];
// maked文件配置
var rendererMd = new marked.Renderer();
//maked文件规则
rendererMd.code = function (code, infostring, escaped) {
    var lang = (infostring || '').match(/\S*/)[0];
    if (this.options.highlight) {
        var out = this.options.highlight(code, lang);
        if (out != null && out !== code) {
            escaped = true;
            code = out;
        }
    }
    if (!lang) {
        return '<pre><code>'
            + (escaped ? code : escape(code, true))
            + '</code></pre>';
    }

    if (lang === 'html') {
        code = code.replace(/@latest/g, '@' + version)
    }

    return '<pre class="prettyprint"><span class="lang">' + lang + '</span><div class="code-wrapper"><code class="'
        + this.options.langPrefix
        + escape(lang, true)
        + '">'
        + (escaped ? code : escape(code, true))
        + '</code></div><i class="copy" copy="copy" data-clipboard-action="copy" data-clipboard-target="code" title="复制代码"></i><i toast="toast" title="全屏"></i></pre>\n';
};
marked.setOptions({
    renderer: rendererMd,
    highlight: function (code) {
        return require('highlight.js').highlightAuto(code).value;
    },
    tables: true
}, res => {

})
/**
 *  是否需要单独处理头部信息
 * @param {text} sorce 替换 头部信息 
 */
function insert(sorce) {
    var insert = sorce.indexOf('</h1>');

    if (insert > -1) {
        return sorce.substring(0, insert) + '<i class="qrcode"><a :href="demourl"><span>请使用手机扫码体验</span><img :src="codeurl" alt=""></a></i>' + sorce.substring(insert, sorce.length);
    } else {
        return sorce
    }

}
///创建一个空文件
/**
 * 修复中 
 * @param {string} output  输出路径
 * @param {string} sorce  文件源
 * @param {boole} ishasCode  是否需要二维码 
 */
function createdFile(output, sorce, ishasCode) {
    var pathSrc = output;    
    if (ishasCode) {
        var res = insert(sorce);
    } else {
        var res = sorce;
    }
    var bufs = `<template><div  @click="dsCode">
        <div v-if="content" class="layer">
          <pre><span class="close-box" @click="closelayer"></span><div v-html="content"></div></pre>
        </div>`+ res + `</div></template><script>import root from '../root.js';
        export default {
            mixins:[root]
        }</script>`;
    fs.writeFile(pathSrc,bufs,'utf8',(err)=>{
       
    })
}
/**
 * 目录读取，找到跟文件
 * @fileSrc {string} 打开文件路径
 * @callback {fn} 结束后回调函数
 */
function readDirRecur(fileSrc, callback) {
    fs.readdir(fileSrc, function(err, files) {
      var count = 0
      var checkEnd = function() {
        ++count == files.length && callback()
      }  
      files.forEach(function(file) {
        var fullPath = fileSrc + '/' + file;  
        fs.stat(fullPath, function(err, stats) {
          if (stats.isDirectory()) {
              return readDirRecur(fullPath, checkEnd);
          } else {
            /*not use ignore files*/
            if(file[0] == '.') {
  
            } else {
              fileList.push(fullPath)            
            }
            checkEnd()
          }
        })
      })  
      //为空时直接回调
      files.length === 0 && callback()
    })
}
function fileReadStar(filedir,callback){
    fs.readFile(filedir, 'utf-8', (err, data) => {
        let html = marked(data); 
        let mdName = "";
        let opensName = filedir.replace(/(^.*\/|.md)/g,"");                    
        //如果是doc文件以前缀 为
        if (opensName === 'doc') {
            mdName = filedir.replace(/(^.*packages\/|\/doc\.md)/g,'');
        } else {
            //如果不是doc命名的文件
            mdName = opensName;
        } 
        callback({
            mdName:mdName,
            html:html
        })   
    });
}
/**
 * 判断是否位md文件 并进行操作
 * 判断文件是否有改动
 * @src {string} 打开的文件目录
 * @hasobj {obj} hash对象
 * @callback {fn} 回调函数
 */
function ismd(src,hasobj,callback){
    //判断文件类型是否是md文件    
    let filedir = src;  
    //return new Promise((resolve,reject)=>{
    if (/.md$/.test(filedir)) {
        if(hasobj.fileText){
            let hasHObjs = hasobj;
            hashElement(filedir).then(res=>{                
                if(hasHObjs.fileText.indexOf(res.hash)==-1){
                    //执行写入
                    //同时更新缓存
                    fs.writeFileSync(hasHObjs.cachePath,
                        hasHObjs.fileText+'|'+res.hash
                        ,'utf-8');

                    fileReadStar(filedir,(obj)=>{
                        callback(obj)
                    })
                }
            })
        }else{
            //如果没有hash 直接做下一部
            fileReadStar(filedir,(obj)=>{
                callback(obj)
            })
        }
        //对md文件存储 hash       
        //文件读取
        
    }
}
/**
 * 检查文件是否存折
 * @param {*} path 
 * @param {*} callback 
 */
function checkIsexists (path,callback){  
    let pathFileName = path.replace(/[^a-zA-Z]/g,'');
    let cacheName = './local'+pathFileName+'.cache';
    fs.exists(cacheName, res=>{
        console.log(res)
        if(!res){
            fs.writeFile(cacheName,'','utf8',()=>{
                callback(cacheName)
            })
        }else{
            callback(cacheName)
        }
    }) 
}
/**
 * 执行文件缓存
 */
let outhash = [];
function pushHash(obj){ 
    //紧紧插入md文件hash                       
    if(/\.md$/.test(obj.name)&&obj['hash']){
        outhash.push(obj.hash);
    }
    if(obj['children']&&obj['children'].length>0){
        obj['children'].map(res=>{
            pushHash(res)
        })
    }              
}
//hash 对比
/**
 * 初始化检查是否有md文件 hash
 * 如果没有 hash 创建一个 json文件并把 md文件 hash进去 用来做缓存
 * 初始化获取所有md文件的 hash
 * @param {*} path 
 */
function comparehash(path,callback){
    checkIsexists(path,(cachePath)=>{       
        //获取文件内容
        let fileText = fs.readFileSync(cachePath,'utf-8');        
         //获取文件 hash    
        hashElement(path, {
            folders: { exclude: ['.*', 'node_modules', 'test_coverage'] },
            files: { include: ['*.md'],exclude:['*.js','*.vue','*.scss','__test__'] }
        }).then(hash => {           
            if(fileText){
                //如果有内容
                callback({
                    fileText:fileText,
                    cachePath:cachePath
                })
            }else{
                pushHash(hash)               
                fs.writeFileSync(cachePath,outhash.join('|'),'utf-8');
                //如果没有内容
                callback({
                    fileText:fileText,
                    cachePath:cachePath
                })
            }
        })
        .catch(error => {
            return console.error('hashing failed:', error);
        }); 
    })
     
}
//文件监听
function filelisten(){    
    let fsWatcher = fs.watchFile(filedir, {
        persistent: true,
        persistent: 1000
    }, (err, data) => {
        //  console.log(err,data,filedir);
        fs.readFile(filedir, 'utf-8', (err, data) => {
            let html = marked(data);
            let filedirarry = filedir.split('/');
            let fileNames = filedirarry[filedirarry.length - 2];
            createdFile(outPath + fileNames + '.vue', html, nohead)
        });
    });
}
/**
 * 文件转md
 * @param {obj} 
 * @entry {string} 文件读取路径 
 * @output {string} 文件输出路径 
 * @needCode {boolen} 是否需要二维码 默认 true
 */
function fileDisplay(param) {
    //检查文件是否第一次初始化并获取hash
    comparehash(param.entry,(hashMsgObj)=>{
        // 获取文件
        readDirRecur(param.entry, function(filePath) {    
            //文件列表        
            fileList.map(item=>{              
                ismd(item,hashMsgObj,res=>{
                    //res md文件处理结果           
                    createdFile(param.output + res.mdName + '.vue', res.html, param.needCode)
                })
            })    
        });
    });
    
}
//md转 其他格式类型
/**
 * 
 * @outPath {String} 输出的文件目录 
 */
function ishasOutFile(outPath,callback){
    fs.stat(outPath,(err,res)=>{       
        if(err){
            fs.mkdir(outPath,erro=>{
                if(erro){
                    
                }else{                  
                    callback()
                }
               
            })
        }else{
            callback()
        }
    })
}
/**
 * 
 * @param {entry} 文件读取路径 
 * @param {output} 文件输出路径 
 * @param {needCode} 是否需要二维码 默认 true
 */
function MdToHtml(commomOption) {
    // 默认参数就这么多了，暂时没想到
    let params = {
        entry:'',
        output:'',
        needCode:true
    }
    params = Object.assign(params,commomOption);    
    //检查输出路径
    ishasOutFile(params.output,()=>{
         //获取所有的md 转html的结果
        fileDisplay(params);
    });
   
}
//用于后期的扩展暂时没想到
MdToHtml.prototype.apply = function (compiler) {
    //  console.log(compiler,'lls')
};

module.exports = MdToHtml;