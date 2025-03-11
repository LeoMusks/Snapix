// 全局变量
let currentLanguage = 'en';

document.addEventListener('DOMContentLoaded', function() {
    // 检查元素是否存在，并记录错误
    const checkElement = (id) => {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Element with ID "${id}" not found in the document`);
            return false;
        }
        return true;
    };

    // 初始化语言
    try {
        // 检查语言选择器是否存在
        if (!checkElement('languageSelector')) {
            throw new Error('Language selector not found');
        }
        
        // 检查语言文件是否已加载
        if (typeof languages === 'undefined') {
            console.error('Languages object is not defined. Make sure languages.js is loaded before popup.js');
            // 尝试动态加载语言文件
            const script = document.createElement('script');
            script.src = 'languages.js';
            script.onload = initLanguage;
            document.head.appendChild(script);
        } else {
            initLanguage();
        }
    } catch (error) {
        console.error('Error initializing language:', error);
    }
  
    // 可视区域截屏
    if (checkElement('captureVisible')) {
        document.getElementById('captureVisible').addEventListener('click', function() {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "captureVisible"});
                window.close();
            });
        });
    }
  
    // 选择区域截屏
    if (checkElement('captureSelection')) {
        document.getElementById('captureSelection').addEventListener('click', function() {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "captureSelection"});
                window.close();
            });
        });
    }
  
    // 整页截屏
    if (checkElement('captureFullPage')) {
        document.getElementById('captureFullPage').addEventListener('click', function() {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "captureFullPage"});
                window.close();
            });
        });
    }
  
    // 添加语言选择器事件
    if (checkElement('languageSelector')) {
        document.getElementById('languageSelector').addEventListener('change', function() {
            currentLanguage = this.value;
            // 保存语言设置
            chrome.storage.local.set({ 'language': currentLanguage }, function() {
                // 更新页面文本
                updatePageLanguage();
                
                // 向所有标签页发送语言更新消息
                chrome.tabs.query({}, function(tabs) {
                    tabs.forEach(function(tab) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: "setLanguage",
                            language: currentLanguage
                        }).catch(() => {
                            // 忽略错误，有些标签页可能无法接收消息
                        });
                    });
                });
            });
        });
    }
});

// 初始化语言
function initLanguage() {
    try {
        // 获取保存的语言设置
        chrome.storage.local.get('language', function(data) {
            if (data.language) {
                currentLanguage = data.language;
            } else {
                // 如果没有保存的设置，使用浏览器语言或默认为英语
                const browserLang = navigator.language;
                currentLanguage = (typeof languages !== 'undefined' && languages[browserLang]) ? browserLang : 'en';
                // 保存语言设置
                chrome.storage.local.set({ 'language': currentLanguage });
            }
            
            // 设置语言选择器的值
            const languageSelector = document.getElementById('languageSelector');
            if (languageSelector) {
                languageSelector.value = currentLanguage;
                
                // 更新页面文本
                updatePageLanguage();
            }
        });
    } catch (error) {
        console.error('Error in initLanguage:', error);
    }
}

// 更新页面语言
function updatePageLanguage() {
    try {
        // 确保语言对象已加载
        if (typeof languages === 'undefined') {
            console.error('Languages object is not defined');
            return;
        }
        
        // 更新所有带有 data-i18n 属性的元素
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = getTranslation(key);
        });
    } catch (error) {
        console.error('Error updating page language:', error);
    }
}

// 获取翻译
function getTranslation(key) {
    try {
        // 确保语言对象已加载
        if (typeof languages === 'undefined') {
            console.error('Languages object is not defined');
            return key;
        }
        
        // 确保当前语言存在，否则使用英语
        const lang = (languages[currentLanguage]) ? currentLanguage : 'en';
        
        // 分割键以访问嵌套对象
        const keys = key.split('.');
        let translation = languages[lang];
        
        // 遍历键路径
        for (const k of keys) {
            if (translation && translation[k] !== undefined) {
                translation = translation[k];
            } else {
                // 如果找不到翻译，返回英文版本或键本身
                let englishTranslation = languages['en'];
                for (const ek of keys) {
                    if (englishTranslation && englishTranslation[ek] !== undefined) {
                        englishTranslation = englishTranslation[ek];
                    } else {
                        return key; // 如果英文版本也没有，返回键本身
                    }
                }
                return englishTranslation;
            }
        }
        
        return translation;
    } catch (error) {
        console.error('Error getting translation:', error);
        return key;
    }
}

// 捕获可视区域
function captureVisibleArea() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "captureVisible"});
        window.close();
    });
}

// 捕获选定区域
function captureSelectedArea() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "captureSelection"});
        window.close();
    });
}

// 捕获整个页面
function captureFullPage() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "captureFullPage"});
        window.close();
    });
}