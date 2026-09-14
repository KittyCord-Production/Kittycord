on chooseAction(msg, ttl, ico)
	try
		set res to display dialog msg with title ttl buttons {"Cancel", "Uninstall", "Install or repair"} default button 3 cancel button 1 with icon (POSIX file ico)
	on error errMsg number errNum
		if errNum is -128 then error number -128
		set res to display dialog msg with title ttl buttons {"Cancel", "Uninstall", "Install or repair"} default button 3 cancel button 1
	end try
	return button returned of res
end chooseAction

on chooseTargets(ttl, names)
	set picked to choose from list names with title ttl with prompt "Which Discord should Kittycord patch?" default items names with multiple selections allowed
	if picked is false then error number -128
	set out to ""
	repeat with n in picked
		set out to out & (n as text) & linefeed
	end repeat
	return out
end chooseTargets

on askCode(msg, ttl, ico)
	try
		set res to display dialog msg with title ttl default answer "" buttons {"Skip", "Continue"} default button 2 with icon (POSIX file ico)
	on error errMsg number errNum
		if errNum is -128 then error number -128
		set res to display dialog msg with title ttl default answer "" buttons {"Skip", "Continue"} default button 2
	end try
	if button returned of res is "Skip" then return ""
	return text returned of res
end askCode

on sayDone(msg, ttl, ico, appName)
	set pressed to ""
	try
		if appName is "" then
			display dialog msg with title ttl buttons {"Close"} default button 1 with icon (POSIX file ico)
		else
			set pressed to button returned of (display dialog msg with title ttl buttons {"Close", "Start Discord"} default button 2 with icon (POSIX file ico))
		end if
	on error errMsg number errNum
		if errNum is not -128 then
			if appName is "" then
				display dialog msg with title ttl buttons {"Close"} default button 1
			else
				set pressed to button returned of (display dialog msg with title ttl buttons {"Close", "Start Discord"} default button 2)
			end if
		end if
	end try
	if pressed is "Start Discord" then
		tell application appName to activate
	end if
	return ""
end sayDone

on sayFailed(msg, ttl)
	try
		return button returned of (display dialog msg with title ttl buttons {"Close", "Show log"} default button 1 with icon stop)
	on error
		return "Close"
	end try
end sayFailed

on notifyUser(msg, ttl)
	try
		display notification msg with title ttl
	end try
	return ""
end notifyUser

on run argv
	set mode to item 1 of argv
	if mode is "action" then
		return chooseAction(item 2 of argv, item 3 of argv, item 4 of argv)
	else if mode is "targets" then
		return chooseTargets(item 2 of argv, items 3 thru -1 of argv)
	else if mode is "code" then
		return askCode(item 2 of argv, item 3 of argv, item 4 of argv)
	else if mode is "done" then
		return sayDone(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
	else if mode is "failed" then
		return sayFailed(item 2 of argv, item 3 of argv)
	else if mode is "notify" then
		return notifyUser(item 2 of argv, item 3 of argv)
	end if
	return ""
end run
