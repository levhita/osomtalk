$(document).ready(function(){
	$('#username').bind('keypress', function(e) {
		if (e.keyCode == 13) {
			takeName();
			e.preventDefault();
		}
	});
});
		
function takeName() {
	var username = $("#username").val();
	$.ajax({
		url: '/user/take/',
		data: {username: username},
		success: function(data) {
			if(data.error) {
				if (data.error=="NAME_TAKEN") {
					$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">Ã—</button><strong>Warning!</strong> Mmmm...that name is already taken.</div>');
				} else if(data.error=="TOO_LONG"){
					$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">Ã—</button><strong>Warning!</strong> That username is too long, the limit is 20 chars</div>');	
				} else if(data.error=="EMPTY"){
					$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">Ã—</button><strong>Warning!</strong> Your name is empty and you should feel bad</div>');
				} else if(data.error=="CHEATER"){
					$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">Ã—</button><strong>Warning!</strong> I see what you did there</div>');
				}

				$('#alert_place_holder').fadeIn();
					setTimeout(function() {
					$('#alert_place_holder').fadeOut();
					} , 3000); 
			} else {
				location.reload();
			}	
		}
	});
};