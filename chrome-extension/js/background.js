import * as P from '../plugin/plugins.ts';
let Plugins = P.default;

// Async load data for given web page on page load
// Listen to events to render shortcuts library

const URL_PATH = 'https://raw.githubusercontent.com/UseMacro/macro-data/master/configs/'
const FILE_EXT = '.json'

function getCurrentTab(callback) {
  let queryInfo = {
    active: true,
    currentWindow: true
  };
  chrome.tabs.query(queryInfo, (tabs) => {
    callback(tabs[0]);
  });
}

function getCurrentTabUrl(callback) {
  getCurrentTab((tab) => {
    callback(tab.url);
  });
}

function get(key, callback) {
  chrome.storage.sync.get(key, (items) => {
    callback(chrome.runtime.lastError ? null : items[key]);
  });
}

function save(key, value) {
  let items = {};
  items[key] = value;
  chrome.storage.sync.set(items);
}

// Copied function from: https://stackoverflow.com/a/23945027
// find & remove protocol (http, ftp, etc.) and get hostname
function extractHostname(url) {
  let hostname;
  if (url.indexOf('://') > -1) {
    hostname = url.split('/')[2];
  } else {
    hostname = url.split('/')[0];
  }

  //find & remove port number
  hostname = hostname.split(':')[0];
  //find & remove '?'
  return hostname.split('?')[0];
}

// Copied function from: https://stackoverflow.com/a/23945027
function extractRootDomain(url) {
  let domain = extractHostname(url),
  splitArr = domain.split('.'),
  arrLen = splitArr.length;

  //extracting the root domain here, check if there is a subdomain
  if (arrLen > 2) {
    domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
    //check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. '.me.uk')
    if (splitArr[arrLen - 1].length == 2 && splitArr[arrLen - 1].length == 2) {
      //this is using a ccTLD
      domain = splitArr[arrLen - 3] + '.' + domain;
    }
  }

  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }

  return domain;
}

function getDomainKey(url) {
  let domain = extractRootDomain(url);
  return URL_PATH.concat(domain, FILE_EXT);
}

// always calls callback: shortcuts missing from MD should not interrupt flow
// since plugins may exist
function getShortcutData(key, callback) {
  let dummy = {name: 'Shortcuts', sections: []};
  let xhr = new XMLHttpRequest();
  xhr.open('GET', key, true);
  xhr.onload = (e) => {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        let json = JSON.parse(xhr.responseText);
        callback(json);
      } else {
        callback(dummy);
        console.error(xhr.statusText);
      }
    }
  };
  xhr.onerror = (e) => {
    callback(dummy);
    console.error(xhr.statusText);
  };
  xhr.send(null);
}

// Adds a plugin section to shortcuts.sections
// only called when plugins were fetched successfully
function mergeData(shortcuts, plugins) {
  let pluginSection = {
    name: 'Plugins',
    description: 'Shortcuts from plugins',
    shortcuts: plugins
  };
  shortcuts.sections.push(pluginSection);
  return shortcuts;
}

function initPlugin(plugin) {
  let data = [];
  plugin.default.getShortcutsMDS().forEach((shortcut) => {
    data.push({
      keys: shortcut.keys,
      action: shortcut.action.toString()
    });
  });
  chrome.tabs.executeScript({ code: 'var plugins = ' + JSON.stringify(data) + ';' }, () => {
    chrome.tabs.executeScript({ file: 'plugins.js' })
  });
}

function initShortcuts(url, renderPanel) {
  let domain = extractRootDomain(url);
  // TODO: support selecting one plugin from multiple per domain (use param?)
  getPlugin(domain,
    // success handler: if got plugins, merge MD shortcuts with plugins, cache & render
    (plugin) => {
      let domainKey = getDomainKey(url);
      getShortcutData(domainKey, (shortcuts) => {
        let data = mergeData(shortcuts, plugin.default.getShortcutsMDS());
        save(domainKey, data);
        renderPanel(data);
      });
      initPlugin(plugin);
    },
    // failure handler: if no plugins, use MD shortcuts, cache & render
    () => {
      let domainKey = getDomainKey(url);
      getShortcutData(domainKey, (shortcuts) => {
        save(domainKey, shortcuts);
        renderPanel(shortcuts);
      });
  });
}

function togglePopup(data) {
  if (data.sections.length > 0) {
    chrome.tabs.executeScript({ code: 'var data = ' + JSON.stringify(data) + ';' }, () => {
      chrome.tabs.executeScript({ file: 'init.js' })
    });
  }
}

function isEmpty(obj) {
  return obj == null || (Object.keys(obj).length === 0 && obj.constructor === Object)
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-popup') {
    getCurrentTabUrl((url) => {
      let key = getDomainKey(url);
        get(key, (data) => {
          if (isEmpty(data)) {
            initShortcuts(url, (shortcutData) => {
              togglePopup(shortcutData);
            });
          } else {
            togglePopup(data);
          }
        });
    });
  }
});

chrome.webNavigation.onCompleted.addListener((details) => {
  let domain = extractRootDomain(details.url);
  getPlugin(domain,
    // success: initialize plugin scripts
    (plugin) => {
      let pluginName = plugin.default.pluginName
      chrome.tabs.executeScript({ file: pluginName + '.js' }, () => {
        chrome.tabs.insertCSS(details.tabId, { file: pluginName + '.css' }, () => {});
        chrome.tabs.sendMessage(details.tabId, { loadShortcuts: true });
      });
    },
    // fail: no plugins found, do nothing
    () => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.hasOwnProperty('url')) {
    initShortcuts(tab.url, () => {});
  }
});

// currently supports 1 plugin per domain
function getPlugin(domain, success, failure) {
  domain in Plugins ? success(Plugins[domain]) : failure();
}
