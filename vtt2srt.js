const vtt2srt = (vttStr) =>{
    var srtUnfilteredStr = vttStr
      .replace(/(\d\d:\d\d:\d\d).(\d\d\d) --> (\d\d:\d\d:\d\d).(\d\d\d)(.*)\n/g, '$1.$2 --> $3,$4\n')
      .replace(/(\d\d:\d\d).(\d\d\d) --> (\d\d:\d\d).(\d\d\d)(.*)\n/g, '$1.$2 --> $3,$4\n')
      .replace(/(\d\d).(\d\d\d) --> (\d\d).(\d\d\d)(.*)\n/g, '$1.$2 --> $3,$4\n')
      .replace(/\<.+\>([^\<\>]+)\<\/.+\>/g, '$1')
      .replace(/\-?\[.*\]/g,'');
    const ptrn = /(^\d+\n)(.*(?:\r?\n?))((?<!\n).*(?:\r?\n(?!\r?\n).*)*)/mg;
    var match = ptrn.exec(srtUnfilteredStr);
    var skipCounter = 0;
    var counter = 0;
    var validSubTimestamps = [];
    while(match != null){
      if((match[3] == "")){
        skipCounter++;
      }else{
        // replace subTimestamp index with index -= skipCounter
        var correctIndex = parseInt(match[1]) - skipCounter;
        correctIndex = correctIndex.toString();
        var parts = [correctIndex, match[2], match[3].replace(/^(\n|\s)+/mg,"")];
        validSubTimestamps.push(parts.join("\n"));
      }
      match = ptrn.exec(srtUnfilteredStr);
      counter++;
    }
    return validSubTimestamps.join("\n\n");
  };