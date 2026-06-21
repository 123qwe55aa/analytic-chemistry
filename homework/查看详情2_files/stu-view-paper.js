// 右侧高度
function markingHeight() {
	var windHeight = $(window).height() - 20;
	var markingH = $("#fanyaMarking").offset().top;
	var personalInfor = $("#personalInfor").innerHeight();
	$('#rightHeight').css({
		'max-height' : windHeight - markingH,
		'top' : markingH
	});// 左侧top
	var ht = windHeight - markingH - personalInfor - 10;
	$('#topicNumberScroll').css('max-height', ht + 'px') // 滚动条高
}

// 右侧滚动条
function topicNumberScroll() {
	$("#topicNumberScroll").niceScroll({
		cursorborder : "",
		cursorwidth : 8,
		cursorcolor : "#e6ecf5",
		boxzoom : false,
		autohidemode : true
	});
	setInterval(function() {
		$("#topicNumberScroll").getNiceScroll().resize(); // 检测滚动条是否重置大小（当窗口改变大小时）
	}, 300)
}

function collectQuestion(questionId, thisObj, questionCourseId, examId) {
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    var hasClass = $(thisObj).hasClass("over_collect_btn");
    if (!hasClass) {
        $.ajax({
            type : 'post',
            url : _HOST_CP2_ + "/exam/test/selfexam-collect",
            dataType:'json',
            data : {
                "courseId": courseId,
                "personId":cpi,
                "questionId":questionId,
                "classId":classId,
                "questionCourseId":questionCourseId,
                "examId" : examId
            },
            success : function(data){
                if (data.status) {
                    $(thisObj).addClass("over_collect_btn");
                    $(thisObj).find(".collectText").html("");
                    $(thisObj).find(".collectText").html("已收藏");
                    $.toast({type: 'success', content: data.msg});
                } else {
                    $.toast({type: 'failure', content: data.msg});
                }
            }
        });
    } else {
        $.ajax({
            type : 'post',
            url : _HOST_CP2_ + "/exam/test/cancel-selfexam-collect",
            dataType:'json',
            data : {
                "courseId": courseId,
                "personId":cpi,
                "questionId":questionId,
                "classId":classId,
                "examId" : examId
            },
            success : function(data){
                if (data.status == true) {
                    $(thisObj).removeClass("over_collect_btn");
                    $(thisObj).find(".collectText").html("");
                    $(thisObj).find(".collectText").html("收藏");
                    $.toast({type: 'success', content: data.msg});
                } else {
                    $.toast({type: 'failure', content: data.msg});
                }
            }
        });
    }
}

$(function(){
	markingHeight();
	
	topicNumberScroll();
	
	window.onresize = function() {
		markingHeight();
	};
	
	$(".topicNumber_list li").click(function(event) {
		var questionId = $(this).attr("data");
		var markingH = $("#fanyaMarking").offset().top + 10;
		var id = ".scroll_" + questionId;
		var ele = $(id);
		if(ele.length == 0){
			return;
		}
		$("html,body").animate({
			scrollTop : ele.offset().top - markingH
		}, 500);
	});


	//点击答案批注横线，选中对应的批注块
	$(document).on('click','.comment_border',function(){
	//$(".comment_border").on("click", function(){
	  var data = $(this).attr("data");
	  if ($(this).hasClass("comment_clicked")) {
	      $(this).removeClass("comment_clicked");
	      $(".commentItem[data='" + data + "']").removeClass("CurcommentItem");
	  } else {
	      $(".comment_border").removeClass("comment_clicked")
	      $(".commentItem").removeClass("CurcommentItem")
	      $(this).addClass("comment_clicked");
	      $(".commentItem[data='" + data + "']").addClass("CurcommentItem");
	      selecMarkScroll(this);
	  }
	});
	
	$(document).on('click','.commentItem',function(){
	  selecMarkComment(this);
	  selecBorderScroll(this)
	});
	
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.comment_border').length && !$(e.target).closest('.commentItem').length) {
            $(".comment_border").each(function (index, obj) {
                var data = $(obj).attr("data");
                $(obj).removeClass("comment_clicked");
                $(".commentItem[data='" + data + "']").removeClass("CurcommentItem");
            });
        }
    });
	
	//气泡显示
	$('.selectable-text').on('mouseenter','.comment_border',function(){
	//$(".comment_border").hover(function() {
		//debugger;
	  var element = $(this);
	  var annoId = element.attr('data');
	  var commentItem = $('.commentItem[data="' + annoId + '"]');
	  if(!commentItem.length){
		  return;
	  }
	  
	  var score = commentItem.find('.comItemScore').text() || '';
	  var comments = commentItem.find('.comItemcont').html() || '';
	  $(".hoverPz").find('.hover-py-num').text(score);
	  $(".hoverPz").find('.comments').html(comments);
	  
	  var rect = element.offset();
	  var Hovertop = rect.top; // 相对于文档顶部的偏移
	  var Hoverleft = rect.left; // 相对于文档左侧的偏移
	  var hoverPop = $(".hoverPz").outerHeight();
	  var conFanya = $("#fanyaMarking").offset().left
	      //console.log(hoverHet)
	      $(".hoverPz").show()
	      $(".hoverPz").css({
	          "top": Hovertop - hoverPop - 80,
	          "left": Hoverleft - conFanya
	      })
	}).on("mouseleave", ".comment_border", function() {
	    // 鼠标离开时的处理逻辑
	    // 例如：隐藏某个元素
	    $(".hoverPz").hide();
	});
	
	
	loadReviewAnnotations();
});


//点击批注块，选中对应批注横线
function selecMarkComment(obj) {
  var data = $(obj).attr("data");
  if ($(obj).hasClass("CurcommentItem")) {
      $(".comment_border[data='" + data + "']").removeClass("comment_clicked");
      $(obj).removeClass("CurcommentItem");
  } else {
      $(".commentItem").removeClass("CurcommentItem");
      $(".comment_border").removeClass("comment_clicked");
      $(obj).addClass("CurcommentItem");
      $(".comment_border[data='" + data + "']").addClass("comment_clicked");
  }
}

//点击批注线，滚动到批注块位置
function selecMarkScroll(obj) {
	  var targetData = $(obj).attr('data'); // 获取被点击span的data属性值
	  var targetElement = $('.commentItem[data="' + targetData + '"]'); // 根据data属性选择对应的div
	  var targetOffset = targetElement.offset().top; // 获取目标div的顶部偏移量
	  // 滚动到目标位置
	  $('html, body').animate({
	      scrollTop: targetOffset - 70
	  }, 500);
}
//点击批注块，滚动到批注线位置
function selecBorderScroll(obj) {
	  var targetData = $(obj).attr('data');
	  var targetBorder = $('.comment_border[data="' + targetData + '"]'); // 根据data属性选择对应的div
	  var targetOffsetbor = targetBorder.offset().top;
	  // 滚动到目标位置
	  $('html, body').animate({
	      scrollTop: targetOffsetbor - 70
	  }, 500);
}


function loadReviewAnnotations(){
    var answerStatus = $("#answerStatus").val();
    if(answerStatus !=3){
    	return;
    }
    
    if(!$('.commentDiv').length){
    	return;
    }
    
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    var id = $("#answerId").val();
    var retestTimes = $("#retestTimes").val();
    $.ajax({
        type : 'get',
        url : _HOST_CP2_ + "/mooc2/exam/review-annotations",
        dataType:'json',
        data : {
            "courseId": courseId,
            "classId": classId,
            "cpi": cpi,
            "id": id,
            "times": retestTimes
        },
        success : function(result){
            if (result.status) {
            	var data = result.data;
            	for(var key in data){
            		var annotations = data[key];
            		if(annotations && annotations.length > 0){
	            		var template = $('#annotationsTpl').jqote({'data':annotations});
	    				$('.commentDiv[data="' + key +  '"]').html(template);
	    				$('.commentDiv[data="' + key +  '"]').parents('.mark_answer').show();
            		}
            	}
				initCommentBorder();
            } 
        }
    });
}

function initCommentBorder(){
	$(".commentDiv").each(function () {
	    var items = $(this).find(".commentItem");
	    if(items.length == 0){
	    	return true;
	    }
	    var qid = $(this).attr("data");
	    var rangeNode = $('.selectable-text[data="' + qid + '"]');
	    items.sort(function (a, b) {
	        return parseInt($(a).attr('data-time')) - parseInt($(b).attr('data-time'));
	    });
	    items.each(function () {
	        var annoid = $(this).attr('data');
	        var range = $(this).attr('data-range');
	        deserializeSelectionHanlde.deserializeSelection(range, annoid, rangeNode);
	    });
	});
}



var deserializeSelectionHanlde = (function () {
	
    function getTextChildByOffset(parent, offset) {
        var nodeStack = [parent];
        var curNode = null;
        var curOffset = 0;
        var startOffset = 0;
        while (curNode = nodeStack.pop()) {
            var children = curNode.childNodes;
            for (var i = children.length - 1; i >= 0; i--) {
                nodeStack.push(children[i]);
            }
            if (curNode.nodeType === 3) {
                startOffset = offset - curOffset;
                curOffset += curNode.textContent.length;
                if (curOffset >= offset) {
                    break;
                }
            }
        }
        if (!curNode) {
            curNode = parent;
        }
        return {
            node: curNode,
            offset: startOffset
        };
    }

    function deserializePosition(positionStr, rootNode) {
        var position = positionStr.split('/');
        var tagName = position[0];
        var index = parseInt(position[1]);
        var offset = parseInt(position[2]);
        var parentNode;
        if (index >= 0) {
            parentNode = rootNode.getElementsByTagName(tagName)[index];
        } else {
            parentNode = rootNode;
        }
        return getTextChildByOffset(parentNode, offset);
    }

    function deserializeRange(serialized, rootNode) {
        var position = serialized.split(',');
        var num = 0;
        if (position.length == 3 && parseInt(position[2]) < rootNode.length) {
            num = parseInt(position[2]);
        }
        var thisRootNode = rootNode[num];
        var start = deserializePosition(position[0], thisRootNode);
        var end = deserializePosition(position[1], thisRootNode);
        var range = rangy.createRange();
        range.setStartAndEnd(start.node, start.offset, end.node, end.offset);
        return range;
    }

    function deserializeSelection(serializedRange, annoId, rootNode) {
        try {
            if (serializedRange) {
                var range = deserializeRange(serializedRange, rootNode);
                if (range) {
                    // 选中反序列化的文本范围
                    rangy.getSelection().removeAllRanges();
                    rangy.getSelection().addRange(range);
                    var applier = rangy.createClassApplier("comment_border", {
                        elementTagName: "x-span",
                        elementAttributes: {
                            "data": annoId
                        }
                    });
                    applier.applyToSelection();
                    rangy.getSelection().removeAllRanges();
                }
            }
        } catch (err) {
            console.log('【' + serializedRange + ',' + annoId + '】' + err.stack);
        }
    }

    return {
    	deserializeSelection: deserializeSelection
    };
})();

