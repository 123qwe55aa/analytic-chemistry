$(function () {
    //错题回顾和举一反三切换
    $(".checkWrong").click(function () {
        var zNum = $(this).index();
        $(".checkWrong").find(".wrong_check").removeClass("wrong_checked");
        $(this).find(".wrong_check").addClass("wrong_checked");
        if (zNum == 1) {
            $(".mistakes").show();
        } else {
            $(".mistakes").hide();
        }
    });
    //推荐数量
    $(".recommendAmount .Amount_check .amount_check").click(function () {
        $(".recommendAmount .Amount_check .amount_check").removeClass("amount_checked");
        $(this).addClass("amount_checked");
    });
    //难易度
    $(".facilityValue .Amount_check .amount_check").click(function () {
        $(".facilityValue .Amount_check .amount_check").removeClass("amount_checked");
        $(this).addClass("amount_checked");
    });
});

function wrongQuesSelfTestPopShow() {
	var  selfTestWrongQuesRecommend = $('#selfTestWrongQuesRecommend').val();
	if(selfTestWrongQuesRecommend == 'true'){
		$('#wrongQuesSelfTestPop').show();
	    MoveFixed();
	}else{
		createSelfExam(0,{});
	}
}


var numReg = /^[1-9][0-9]{0,}$/;
var blandReg = /^\s*$/;
function checkNum(obj) {
    var v = obj.value;
    obj.value = v.replace(/[^\d]/g, '');
    var maxNum = $('#wrongQuestionCount').attr('data') || 0;
    var num = obj.value;
    if (blandReg.test(num) || isNaN(maxNum)) {
        return;
    }
    if (parseInt(num) > parseInt(maxNum)) {
        obj.value = '';
        $.toast({ type: 'notice',content: '抽题数不允许大于题目总数'});
    }
}

function createSelfExamAction() {
	 var recommendSet = {};
    var selType = $(".checkWrong").find(".wrong_checked").attr('data') || 0;
    if (selType == 1) {
        var recommendMode = $(".recommendAmount .Amount_check .amount_checked").attr('data');
        var recommendEasy = $(".facilityValue .Amount_check .amount_checked").attr('data');
        recommendSet.mode = recommendMode;
        recommendSet.easy = recommendEasy;
    } 
    createSelfExam(selType,recommendSet);
}


function createSelfExam(selType,recommendSet) {
    var createType = 2;
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var answerId = $("#answerId").val();
    var cpi = $("#cpi").val();

    $.ajax({
        type: "post",
        dataType: "json",
        url: _HOST_CP2_ + "/mooc2/exam/create-self-test",
        data: {
            "courseId": courseId,
            "classId": classId,
            "answerId": answerId,
            "cpi": cpi,
            "from": 'examWrongQuestion',
            "createType": createType,
            "selectType": selType,
            "recommendSet": JSON.stringify(recommendSet)
        },
        success: function (json) {
            if (json.status) {
                $("#wrongQuesSelfTestPop").hide();
                setTimeout(function () {
                    var taskId = json.taskId;
                    $('#taskId').val(taskId);
                    showTaskPop(taskId);
                }, 200);
            } else {
                $.toast({type: 'failure',content: json.msg});
            }
        },
        error: function () {
            $.toast({type: 'failure', content: '创建失败'});
        }
    });
}



function checkExamWrongQuesSelf() {
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    var answerId = $("#answerId").val();
    $.ajax({
        type: "get",
        dataType: "json",
        url: _HOST_CP2_ + "/mooc2/exam/examwrongques-selftest",
        data: {
            "courseId": courseId,
            "classId": classId,
            "examAnswerId": answerId,
            "cpi": cpi
        },
        success: function (json) {
            if (json.status) {
                var relationId = json.relationId || 0;
                if (relationId > 0) {
                    $('#examWrongQuesPop .continueAnswer').attr('onclick', "continueSelfTest(" + relationId + ")");
                    $('#examWrongQuesPop .reAnswer').attr('onclick', "checkPendingSelfTask()");
                    $('#examWrongQuesPop').fullFadeIn();
                } else {
                    wrongQuesSelfTestPopShow();
                }
            } else {
                  $.toast({type: 'failure',content: json.msg});
            }
        },
        error: function () {
            $.toast({type: 'failure',content: '操作失败'});
        }
    });
}

function continueSelfTest(relationId) {
    $('#examWrongQuesPop').fullFadeOut();
    startSelfExam(relationId);
}

function reCreateSelfTest() {
    $('#examWrongQuesPop').fullFadeOut();
    wrongQuesSelfTestPopShow();
}

function startSelfExam(relationId) {
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    var examNotesUrl = _HOST_CP2_ + '/exam/test/examcode/examnotes?courseId=' + courseId + '&classId=' + classId + '&examId=' + relationId + '&cpi=' + cpi;
    window.open(examNotesUrl);
}


//组卷状态
var selfTest_AutoTaskInterval;
var rate = 0;
var round = 0;
var selfTest_rotation_limit = 200;
function showTaskPop(taskId) {
    $("#stuSelfTestAutoPaper").fullFadeIn();
    //MoveFixed();
    rate = 1;
    round = 0;
    var tip = "自测试卷生成中，已完成";
    if (typeof I18N !== "undefined" && I18N.hasOwnProperty("selfTestCreating")) {
        tip = I18N.selfTestCreating;
    }
    $("#taskTip").text(tip);
    callSelfTestTaskStatus(taskId);
}

function updateSelfTestTaskPop() {
    var taskRate = $("#taskrate");
    if (rate >= 95) {
        rate += 0.1;
        round++;
        if (round > 4) {
            var tip = "任务繁忙，请耐心等待。 已完成";
            if (typeof I18N !== "undefined" && I18N.hasOwnProperty("taskBusy")) {
                tip = I18N.taskBusy;
            }
            $("#taskTip").text(tip);
        }
    } else {
        rate += Math.round(Math.random() * 30);
        if (rate >= 95) {
            rate = 95.0;
        }
    }
    if(rate >= 100){
        rate = 99.9;
    }
    $(".taskStatusShowHide .barCon").css("width",rate + "%");
    taskRate.html(truncateToOneDecimalString(rate) + "%");
}

function hideSelfTestTaskPop() {
    clearAutoTaskInterval();
    $("#stuSelfTestAutoPaper").fullFadeOut();
}

function clearAutoTaskInterval() {
    window.clearInterval(selfTest_AutoTaskInterval);
}

function callSelfTestTaskStatus(taskId, times) {
    var _interval = times || 3000;
    updateSelfTestTaskPop();
    selfTest_AutoTaskInterval = setTimeout('selfTestTaskStatus(' + taskId + ');', _interval);
}

function selfTestTaskStatus(taskId) {
    selfTest_rotation_limit--;
    if (selfTest_rotation_limit <= 0) {
        return;
    }
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    var answerId = $("#answerId").val();
    var url = _HOST_CP2_ + "/mooc2/exam/selftest-autopapertask-status?courseId=" + courseId + "&classId=" + classId + "&cpi=" + cpi + "&taskId=" + taskId 
    + "&from=examWrongQuestion" + "&answerId=" + answerId;
    $.ajax({
        type: 'get',
        url: url,
        dataType: 'json',
        success: function (data) {
            if (data.status) {
                if (data.taskStatus == 'ok') {
                    clearAutoTaskInterval();
                    $("#taskrate").html("100%");
                    $(".taskStatusShowHide .barCon").css("width", "100%");
                    //$("#taskCancle").hide();
                    //$("#taskOkKnown").show();
                    $.toast({ type: 'success', content: '创建成功'});
                    hideSelfTestTaskPop();
                    var relationId = data.relationId
                    if(relationId > 0){
	                    setTimeout(function () {
	                    	startSelfExam(relationId);
	                    }, 500);
                    }
                } else if (data.taskStatus == 'invalid') {
                    hideSelfTestTaskPop();
                    $.toast({type: 'failure',content: '无效的操作'});
                } else if (data.taskStatus == 'fail') {
                    hideSelfTestTaskPop();
                    $.toast({type: 'failure',content: '自测试卷生成失败' });
                } else if (data.taskStatus == 'running') {
                    callSelfTestTaskStatus(taskId, 5000);
                } else if (data.taskStatus == 'busy') {
                    //TODO
                    // var info = $(".taskStatusShowHide .barInfo");
                    // info.html(info.html()+",任务繁忙稍后再来看看");
                    callSelfTestTaskStatus(taskId, 10000);
                } else {
                    hideSelfTestTaskPop();
                    $.toast({type: 'failure',content: '自测试卷生成失败'});
                }
            } else {
                //失败
                hideSelfTestTaskPop();
                $.toast({type: 'failure',content: '自测试卷生成失败'});
            }

        },
        error: function () {
            //callSelfTestTaskStatus();
        }
    });
    return;
}

function cancleSelfTestTask() {
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    var taskId = $("#taskId").val();
    var url = _HOST_CP2_ + "/mooc2/exam/selftest-cancel-autopapertask?courseId=" + courseId + "&classId=" + classId + "&cpi=" + cpi + "&taskId=" + taskId;
    $.ajax({
        type: 'get',
        url: url,
        dataType: 'json',
        success: function (data) {
            if (data.status) {
                hideSelfTestTaskPop();
            } else {
                hideSelfTestTaskPop();
                $.toast({ type: 'failure',content: '操作失败'});
            }
        },
        error: function () {}
    });
    return;
}

function truncateToOneDecimalString(num) {
    var str = num.toString();
    var dotIndex = str.indexOf('.');
    if (dotIndex === -1) {
        return str;
    }
    return str.slice(0, dotIndex + 2);
}

$(function () {
    $('#stuSelfTestAutoPaper').on('click', '#taskCancle', function () {
        cancleSelfTestTask();
    })
    $('#stuSelfTestAutoPaper').on('click', '.popClose', function () {
        hideSelfTestTaskPop();
    })
})

function deleteSelfTestPop(id, classId) {
    $('.confirmDelete').attr('onclick', 'confirmDeleteSelfTest(' + id + ',' + classId + ')');
    $('#confirmPop').fullFadeIn();
}

function confirmDeleteSelfTest(testPaperId, classId) {
    $.ajax({
        type: "get",
        url: _HOST_CP2_ + "/exam/test/deleteTestNew",
        data: {
            "id": testPaperId,
            "classId": classId,
            "recyle": 1
        },
        success: function (data) {
            $('#confirmPop').fullFadeOut();
            parent.location.reload();
        }
    });
}


function checkSelfTestRecommend() {
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    $.ajax({
        type: "get",
        dataType: "json",
        url: _HOST_CP2_ + "/mooc2/exam/self-recommend",
		timeout: 5000,
        data: {
            "courseId": courseId,
            "classId": classId,
            "cpi": cpi
        },
        success: function (json) {
            if(json.status && json.recommend) {
			   $('#selfTestWrongQuesRecommend').val(true);
			}
        }
    });
}

var checkPendingLock = 0;
var previousSelfTaskId = null;

function continuePreviousSelfTest() {
    var selfTestCheckPop = $("#selfTestCheckPop");
    if (previousSelfTaskId == null || previousSelfTaskId <= 0) {
        selfTestCheckPop.fadeOut();
        wrongQuesSelfTestPopShow();
        return;
    }
    selfTestCheckPop.fadeOut();
    showTaskPop(previousSelfTaskId);
    previousSelfTaskId = null;
}

function cancelAndCreate() {
    var selfTestCheckPop = $("#selfTestCheckPop");
    if (previousSelfTaskId == null || previousSelfTaskId <= 0) {
        selfTestCheckPop.fadeOut();
        wrongQuesSelfTestPopShow();
        return;
    }
    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    $.ajax({
        type: "post",
        dataType: "json",
        url: _HOST_CP2_ + "/mooc2/exam/cancel-pending-self-task?courseId=" + courseId + "&classId=" + classId + "&cpi=" + cpi + "&excludeIds=" + previousSelfTaskId,
        timeout: 5000,
        success: function () {
            wrongQuesSelfTestPopShow();
        },
        error: function () {
            $.toast({type: 'failure', content: '网络错误!'});
        },
        complete: function () {
            previousSelfTaskId = null;
        }
    });
    selfTestCheckPop.fadeOut();
}

function checkPendingSelfTask() {
    if (checkPendingLock === 1) {
        return;
    }
    previousSelfTaskId = null;
    checkPendingLock = 0;
    $('#examWrongQuesPop').fullFadeOut();
    if ($("#allowMultiplePendingSelfTask").val() === "true") {
        try {
            wrongQuesSelfTestPopShow();
        } catch (e) {
            console.log(e);
        }
        checkPendingLock = 0;
    } else {
        var courseId = $("#courseId").val();
        var classId = $("#classId").val();
        var cpi = $("#cpi").val();
        var checkTimeout = setTimeout(function () {
            $.toast({type: 'failure', content: '请求超时!'});
            checkPendingLock = 0;
        }, 3_500);
        $.ajax({
            type: "get",
            dataType: "json",
            url: _HOST_CP2_ + "/mooc2/exam/check-pending-self-task",
            timeout: 3000,
            data: {
                "courseId": courseId,
                "classId": classId,
                "cpi": cpi
            },
            success: function (data) {
                if (data.status) {
                    var pendingTaskId = data["pendingTaskId"];
                    if (pendingTaskId !== undefined && pendingTaskId > 0) {
                        previousSelfTaskId = pendingTaskId;
                        $("#selfTestCheckPop").fadeIn();
                        return;
                    }
                }
                createSelfExam();
            },
            error: function () {
                $.toast({type: 'failure', content: '网络错误!'});
            },
            complete: function () {
                checkPendingLock = 0;
                clearTimeout(checkTimeout);
            }
        });
    }
}