var hoverSet = new Set();
$(function () {
  var topicOnHover = $('a[topicid]');
  topicOnHover.on('mouseover', function () {
    var _this = $(this);
    var topicId = _this.attr("topicid");
    if (hoverSet.has(topicId)) {
      return;
    }
    hoverSet.add(topicId);
    var nameCacheAttribute = "fulltopicpath";
    if (_this[0].hasAttribute(nameCacheAttribute)) {
      appendHover(_this, topicId, _this.attr(nameCacheAttribute));
      return;
    }
    var courseId = $('#courseId').val();
    var classId = $('#classId').val();
    $.ajax({
      type: "get",
      url: _HOST_CP2_ + "/coursedata/get-full-topic-path",
      dataType: "json",
      data: {
        "courseId": courseId,
        "classId": classId,
        "topicId": topicId,
        "ut": "s",
      },
      success: function (data) {
        if (data.status) {
          var topicName = data.msg || "";
          appendHover(_this, topicId, topicName);
          _this.attr("fulltopicpath", topicName);
        }
      }
    });
  });

  topicOnHover.on('mouseout', function () {
    var topicId = $(this).attr("topicId")
    hoverSet.delete(topicId);
    $('[id^="hover_"]').remove();
  });

});

function appendHover(_this, topicId, topicName) {
  var hoverId = "hover_" + topicId;
  var hoverHtml = "<div id='" + hoverId + "' class='selectDivHover' style='display: none'><div class='selectDivHoverArrow'></div>无父级节点</div>"
  if (topicName) {
    hoverHtml = "<div id='" + hoverId + "' class='selectDivHover' style='display: none'><div class='selectDivHoverArrow'></div>父级节点：<div></div></div>"
  }
  if (!hoverSet.has(topicId)) {
    return;
  }
  $("body").append(hoverHtml);
  var hoverElement = $("#" + hoverId);
  hoverElement.children("div").eq(1).text(unescapeHTML(topicName));
  var maxWidth = hoverElement.parent()[0].getBoundingClientRect().width;
  if (maxWidth && maxWidth > 0) {
      hoverElement.css("max-width", maxWidth);
  }
  var rect = _this[0].getBoundingClientRect();
  var borderWidth = parseInt(hoverElement.find(".selectDivHoverArrow").css("border-width"));
  var top = rect.bottom + borderWidth * 2;
  var hoverOuterWidth = hoverElement.outerWidth(true);
  var left = rect.left + (rect.width - hoverOuterWidth) / 2;
  if (left < 0) {
    left = 0;
    var offset = hoverOuterWidth - (rect.right - rect.width / 2 - borderWidth);
    if (offset < 0) {
      offset = borderWidth * 2;
    }
    hoverElement.find(".selectDivHoverArrow").css("left", offset + "px");
  }
  if (left + hoverOuterWidth > window.innerWidth) {
    left = window.innerWidth - hoverOuterWidth;
    var offset = rect.right - rect.width / 2 - borderWidth - left;
    if (offset > hoverOuterWidth) {
      offset = hoverOuterWidth - borderWidth * 2;
    }
    hoverElement.find(".selectDivHoverArrow").css("left", offset + "px");
  } else {
    hoverElement.find(".selectDivHoverArrow").css("left", (rect.left - left + rect.width/ 2 - borderWidth) + "px");
  }
  if (top + hoverElement.outerHeight(true) <= window.innerHeight) {
    hoverElement.css({
      top: top + "px",
      left: left + "px"
    })
  } else {
    hoverElement.find("div").first().removeClass("selectDivHoverArrow");
    hoverElement.find("div").first().addClass("selectDivHoverArrowBottom");
    hoverElement.css({
      bottom: window.innerHeight - rect.top + borderWidth * 2 + "px",
      left: left + "px"
    })
  }
  hoverElement.show();
}

function unescapeHTML(str) {
  return str.replace(/&lt;|&gt;|&amp;|&quot;|&#39;/g, function (a) {
    return {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#39;': "'"
    }[a];
  });
}