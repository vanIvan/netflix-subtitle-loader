chrome.runtime.onMessage.addListener(
  function(arg, sender, sendResponse) {
	console.log("chrome.runtime.onMessage");
	console.log(arg);

    chrome.downloads.download({
		url: arg.url,
		filename: arg.title + ".zip",
		saveAs: false
    });
});

function sendResponse(){}