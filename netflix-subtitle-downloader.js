// ==UserScript==
// @name        Netflix - subtitle downloader
// @description Allows you to download subtitles from Netflix
// @license     MIT
// @version     3.0.5
// @namespace   tithen-firion.github.io
// @include     https://www.netflix.com/*
// @grant       unsafeWindow
// @require     https://cdn.jsdelivr.net/gh/Stuk/jszip@579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.jsdelivr.net/gh/eligrey/FileSaver.js@283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// ==/UserScript==

const MAIN_TITLE = '.player-status-main-title, .ellipsize-text>h4, .video-title>h4';
const TRACK_MENU = '#player-menu-track-settings, .audio-subtitle-controller';
const NEXT_EPISODE = '.player-next-episode:not(.player-hidden), .button-nfplayerNextEpisode';

const WEBVTT = 'webvtt-lssdh-ios8';

const DOWNLOAD_MENU = `<lh class="list-header">Netflix subtitle downloader</lh>
<li class="list-header">Netflix subtitle downloader</li>
<li class="track download">Download subs for this episode</li>
<li class="track download-all">Download subs from this ep till last available</li>
<h3 class="list-header">Format</h3>
<ul id="subtitle-format-selector">
  <li class="format-track selected" data-uia="vtt">vtt</li>
  <li class="format-track" data-uia="srt">srt</li>
</ul>`;

const SCRIPT_CSS = `.player-timed-text-tracks, .track-list-subtitles{ border-right:1px solid #000 }
.player-timed-text-tracks+.player-timed-text-tracks, .track-list-subtitles+.track-list-subtitles{ border-right:0 }
#player-menu-track-settings .subtitle-downloader-menu li.list-header,
.audio-subtitle-controller .subtitle-downloader-menu lh.list-header{ display:none }`;

const SUB_TYPES = {
  'subtitles': '',
  'closedcaptions': '[cc]'
};

const FORMAT_SELECT_ID = "subtitle-format-selector";

let zip;
let subCache = {};
let batch = false;
let format = "vtt";
let seriesName = "";
let seasonEpisode = "";

const randomProperty = obj => {
  const keys = Object.keys(obj);
  return obj[keys[keys.length * Math.random() << 0]];
};

// get show name or full name with episode number
const __getTitle = full => {
  if(typeof full === 'undefined')
    full = true;
  const titleElement = document.querySelector(MAIN_TITLE);
  if(titleElement === null)
    return null;
  const title = [titleElement.textContent.replace(/[:*?"<>|\\\/]+/g, '_').replace(/ /g, '.')];
  if(full) {
    const episodeElement = titleElement.nextElementSibling;
    if(episodeElement) {
      const m = episodeElement.textContent.match(/^[^\d]*?(\d+)[^\d]*?(\d+)?[^\d]*?$/);
      if(m && m.length == 3) {
        if(typeof m[2] == 'undefined') // example: Stranger Things season 1
          title.push(`S01E${m[1].padStart(2, '0')}`);
        else
          title.push(`S${m[1].padStart(2, '0')}E${m[2].padStart(2, '0')}`);
      }
    }
    title.push('WEBRip.Netflix');
  }
  return title.join('.');
};
// helper function, periodically checking for the title and resolving promise if found
const _getTitle = (full, resolve) => {
  const title = __getTitle(full);
  if(title === null)
    window.setTimeout(_getTitle, 200, full, resolve);
  else
    resolve(title);
};
// promise of a title
const getTitle = full => new Promise(resolve => {
  _getTitle(full, resolve);
});

const processSubInfo = async result => {
  const tracks = result.timedtexttracks;
  const titleP = getTitle();
  const subs = {};
  for(const track of tracks) {
    if(track.isNoneTrack)
      continue;

    let type = SUB_TYPES[track.rawTrackType];
    if(typeof type === 'undefined')
      type = `[${track.rawTrackType}]`;
    const lang = track.language + type + (track.isForcedNarrative ? '-forced' : '');
    subs[lang] = randomProperty(track.ttDownloadables[WEBVTT].downloadUrls);
  }
  subCache[result.movieId] = {titleP, subs};

  if(batch) {
    downloadAll();
  }
};

const getMovieID = () => window.location.pathname.split('/').pop();


const _save = async (_zip, title) => {
  const content = await _zip.generateAsync({type:'blob'});
  console.log("chrome.runtime.sendMessage");
  var url = window.URL.createObjectURL(content);
  chrome.runtime.sendMessage(
    {
      url : url,
      title : title
    }
  );
};

// All timestamped lines
const _download = async _zip => {  
  const {titleP, subs} = subCache[getMovieID()];
  const downloaded = [];
  for(const [lang, url] of Object.entries(subs)) {
    const result = await fetch(url, {mode: "cors"});
    const data = await result.text();
    downloaded.push({lang, data});
  }
  const title = await titleP;  
  const name = [seriesName.replace(/\s/mg,"."), seasonEpisode].join(".").replace( /[<>:"\/\\|?*]+/g,'');
  downloaded.forEach(x => {
    const {lang, data} = x;
    switch(format){
      case "srt":
       _zip.file(`${[name,lang].join(".")}.srt`, vtt2srt(data));
      break;

      default:
        _zip.file(`${[name,lang].join(".")}.vtt`, data);
    }
  });

  return await [name, format.toUpperCase()].join(".").replace( /[<>:"\/\\|?*]+/g, '' );
};

const downloadThis = async () => {  
  const _zip = new JSZip();
  const showTitle = await _download(_zip);
  _save(_zip, showTitle);
};  

const downloadAll = async () => {
  zip = zip || new JSZip();
  batch = true;
  const showTitle = await _download(zip);
  const nextEp = document.querySelector(NEXT_EPISODE);
  if(nextEp)
    nextEp.click();
  else {
    await _save(zip, showTitle);
    zip = undefined;
    batch = false;
  }
};

const processMessage = e => {
	console.log(e);
  processSubInfo(e.detail);
}

const injection = () => {
  const WEBVTT = 'webvtt-lssdh-ios8';

  // hijack JSON.parse and JSON.stringify functions
  ((parse, stringify) => {
    JSON.parse = function (text) {
      const data = parse(text);
      if (data && data.result && data.result.timedtexttracks && data.result.movieId) {
        window.dispatchEvent(new CustomEvent('netflix_sub_downloader_data', {detail: data.result}));
      }
      return data;
    };
    JSON.stringify = function (data) {
      if (data && data.params && data.params.profiles) {
        data.params.profiles.unshift(WEBVTT);
      }
      return stringify(data);
    };
  })(JSON.parse, JSON.stringify);
}

window.addEventListener('netflix_sub_downloader_data', processMessage, false);

// inject script
const sc = document.createElement('script');
sc.innerHTML = '(' + injection.toString() + ')()';
document.head.appendChild(sc);
document.head.removeChild(sc);

// add CSS style
const s = document.createElement('style');
s.innerHTML = SCRIPT_CSS;
document.head.appendChild(s);

// Process series episode, name, subtitle format
const processEpisodeInfo = () => {
  var seasonEpisodeSpan = $("div.video-title div span")[0];
  var seriesNameEl = $("div.video-title div h4")[0];
  seasonEpisode = seasonEpisodeSpan == undefined ? "" : seasonEpisodeSpan.textContent;
  seasonEpisode = seasonEpisode.replace(/\:/mg,".");
  seriesName = seriesNameEl.textContent;
};

const injectElements = (parent) => {
  let ol = document.createElement('ol');
  ol.setAttribute('class', 'subtitle-downloader-menu player-timed-text-tracks track-list track-list-subtitles');
  ol.innerHTML = DOWNLOAD_MENU;
  parent.appendChild(ol);
  ol.querySelector('.download').addEventListener('click', downloadThis);
  ol.querySelector('.download-all').addEventListener('click', downloadAll);
}

const addFormatSelectEvListeners = ()=>{
  $("#subtitle-format-selector li.format-track").on('click', function(ev){
    $("#subtitle-format-selector li.format-track").removeClass("selected");
    ev.target.classList.add("selected");
    format = ev.target.dataset.uia;
  });
}

// add menu when it's not there
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      if(node.nodeName.toUpperCase() == 'DIV') {
        let trackMenu = (node.parentNode || node).querySelector(TRACK_MENU);
        if(trackMenu !== null && trackMenu.querySelector('.subtitle-downloader-menu') === null) {        
          injectElements(trackMenu);
          addFormatSelectEvListeners()
          processEpisodeInfo();       
        }
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });