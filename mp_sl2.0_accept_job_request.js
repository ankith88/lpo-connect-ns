/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Tue May 05 2026
 * Modified on:          Tue May 05 2026 17:33:55
 * SuiteScript Version:  2.0
 * Description:
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */

define([
	"N/ui/serverWidget",
	"N/email",
	"N/runtime",
	"N/search",
	"N/record",
	"N/http",
	"N/log",
	"N/redirect",
	"N/format",
	"N/https",
	"N/encode"
], function (
	ui,
	email,
	runtime,
	search,
	record,
	http,
	log,
	redirect,
	format,
	https,
	encode
) {
	var role = 0;
	var userId = 0;
	var zee = 0;

	function onRequest(context) {
		var baseURL = "https://system.na2.netsuite.com";
		if (runtime.EnvType == "SANDBOX") {
			baseURL = "https://system.sandbox.netsuite.com";
		}
		userId = runtime.getCurrentUser().id;
		role = runtime.getCurrentUser().role;

		var lpoLeadBDMAssigned = null;

		var date = new Date();
		var date_now = format.parse({
			value: date,
			type: format.Type.DATE
		});
		var time_now = format.parse({
			value: date,
			type: format.Type.TIMEOFDAY
		});

		var zeeName = null;
		var zeeEmail = null;
		var zeePhone = null;

		if (context.request.method === "GET") {
			log.debug({
				title: "context.request.parameters",
				details: context.request.parameters
			});

			//{"firstName":"B","compid":"1048144","job_id":"d1xtlegqYh2F0LYl8fnR","lpo_id":"1974139","service":"site-to-lpo","ns-at":"AAEJ7tMQhaB4QYR7Pw-EtSlrxcIMl2il8br6cxfmm6xmf7VP-1w","customer_id":"1995828","script":"2536","email":"ankith88+bvs@gmail.com","deploy":"1"}

			var lpoPlusJobId = context.request.parameters.job_id;
			var lpoPlusJobDate = context.request.parameters.date;
			var prettyDate = formatDateToLongReadable(lpoPlusJobDate);
			var lpoPlusJobFrequency = context.request.parameters.frequency;
			var lpoPlusService = context.request.parameters.service;
			//Convert service to uppercase.
			lpoPlusService = lpoPlusService.toUpperCase();
			var contactEmail = context.request.parameters.email;
			var contactFirstName = context.request.parameters.firstName;
			var lpoParentId = context.request.parameters.lpo_id;

			var lpoParentCustomerRecord = record.load({
				type: record.Type.CUSTOMER,
				id: lpoParentId
			});
			var lpoName = lpoParentCustomerRecord.getValue({
				fieldId: "companyname"
			});
			var lpoEmail = lpoParentCustomerRecord.getValue({
				fieldId: "email"
			});
			var lpoNameArray = lpoName.split(" - ");
			lpoName = lpoNameArray[0].trim();

			//Get LPO Contact Details
			var lpoContactInternalID = "";
			var lpoContactFirstName = "";
			var lpoContactLastName = "";
			var lpoContactEmail = "";
			var lpoContactPhone = "";
			//Get Contact Details
			// NetSuite Search: SALESP - Contacts
			var searched_contacts = search.load({
				id: "customsearch_salesp_contacts",
				type: "contact"
			});

			searched_contacts.filters.push(
				search.createFilter({
					name: "internalid",
					join: "CUSTOMER",
					operator: search.Operator.ANYOF,
					values: lpoParentId
				})
			);
			resultSetContacts = searched_contacts.run();

			var serviceContactResult = resultSetContacts.getRange({
				start: 0,
				end: 1
			});
			if (serviceContactResult.length == 1) {
				lpoContactInternalID = serviceContactResult[0].getValue({
					name: "internalid"
				});
				lpoContactFirstName = serviceContactResult[0].getValue({
					name: "firstname"
				});
				lpoContactLastName = serviceContactResult[0].getValue({
					name: "lastname"
				});
				lpoContactEmail = serviceContactResult[0].getValue({
					name: "email"
				});
				lpoContactPhone = serviceContactResult[0].getValue({
					name: "phone"
				});
			}

			var appJobGroupId = context.request.parameters.appJobGroupId;
			var message = context.request.parameters.message;

			var customerInternalId = context.request.parameters.customer_id;
			var customerRecord = record.load({
				type: "customer",
				id: customerInternalId
			});
			var business_name = customerRecord.getValue({
				fieldId: "companyname"
			});
			var partnerID = customerRecord.getValue({
				fieldId: "partner"
			});
			var customerEmail = customerRecord.getValue({
				fieldId: "email"
			});

			//Get Contact Details
			// NetSuite Search: SALESP - Contacts
			var searched_contacts = search.load({
				id: "customsearch_salesp_contacts",
				type: "contact"
			});

			searched_contacts.filters.push(
				search.createFilter({
					name: "internalid",
					join: "CUSTOMER",
					operator: search.Operator.ANYOF,
					values: customerInternalId
				})
			);
			resultSetContacts = searched_contacts.run();

			var serviceContactResult = resultSetContacts.getRange({
				start: 0,
				end: 1
			});

			var primaryContactInternalID = "";
			var customerContactFirstName = "";
			var customerContactLastName = "";
			var customerContactEmail = "";
			var customerContactPhone = "";
			if (serviceContactResult.length == 1) {
				primaryContactInternalID = serviceContactResult[0].getValue({
					name: "internalid"
				});
				customerContactFirstName = serviceContactResult[0].getValue({
					name: "firstname"
				});
				customerContactLastName = serviceContactResult[0].getValue({
					name: "lastname"
				});
				customerContactEmail = serviceContactResult[0].getValue({
					name: "email"
				});
				customerContactPhone = serviceContactResult[0].getValue({
					name: "phone"
				});
			}

			var customerPartnerRecord = record.load({
				type: "partner",
				id: partnerID
			});

			var partnerName = customerPartnerRecord.getValue({
				fieldId: "companyname"
			});
			var mainContactName = customerPartnerRecord.getValue({
				fieldId: "custentity3"
			});
			var partnerPhone = customerPartnerRecord.getValue({
				fieldId: "custentity2"
			});
			var partnerEmail = customerPartnerRecord.getValue({
				fieldId: "email"
			});

			partnerPhone = partnerPhone.replace(/ /g, "");
			partnerPhone = partnerPhone.slice(1);
			partnerPhone = "+61" + partnerPhone;

			//Send Email to LPO and end customer letting them know the job request has been accepted by the franchisee.

			var emailToCustomerSubject =
				"Booking confirmed — " + business_name + " (" + lpoPlusService + ")";

			//Send Email to End Customer
			var emailToCustomerBody =
				"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}/* Reminder note — only appears for recurring */ .reminder-note { background: #EBF4FB; border-radius: 8px; padding: 16px 20px; margin: 24px 0; font-size: 14px; display: flex; gap: 14px; align-items: flex-start; } .reminder-note .icon { width: 32px; height: 32px; background: var(--navy); color: var(--amber-bright); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; font-weight: 700; } .reminder-note p { margin: 0; line-height: 1.55; } .reminder-note p strong { color: var(--navy); }.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head>";
			var year = new Date().getFullYear();
			//Email to LPO to let them know the job request has been accepted by the franchisee.

			emailToCustomerBody +=
				'<body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">Your booking is confirmed.</div><p>Hello ' +
				contactFirstName +
				",</p><p>Good news — your local post office and our courier team have agreed on the details, and your " +
				business_name +
				" pickup is now booked in.</p>";
			//Job Details Section
			emailToCustomerBody +=
				'<div class="job-details"><div class="detail-row"><span class="detail-label">Reference:</span><span class="detail-value">' +
				lpoPlusJobId +
				'</span></div><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
				lpoPlusService +
				'</span></div><div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">' +
				prettyDate +
				"</span></div>";
			if (!isNullorEmpty(lpoPlusJobFrequency)) {
				emailToCustomerBody +=
					'<div class="detail-row"><span class="detail-label">Frequency:</span><span class="detail-value">' +
					lpoPlusJobFrequency +
					"</span></div></div>";

				emailToCustomerBody +=
					'<div class="reminder-note"><div class="icon">↻</div><p>Because this is a recurring service, we\'ll send you a quick reminder on the morning of each scheduled pickup day so you know to have your parcels ready. <strong>You don\'t need to do anything to confirm each visit</strong> — the schedule runs automatically.</p></div>';
			} else {
				emailToCustomerBody += "</div>";
			}

			emailToCustomerBody +=
				"<p>If anything changes — you don't need a pickup that day, or you'd like to add or remove a day from the schedule — just reply to this email and your local post office team will sort it out for you.</p><p>Thanks for choosing your local Licensed Post Office.</p>";

			emailToCustomerBody +=
				'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
				year +
				" lpo.plus. All rights reserved.</p></div></div></body></html>";

			var sendOutEmailJSON = {
				to: contactEmail,
				subject: emailToCustomerSubject,
				html: emailToCustomerBody,
				metadata: {
					lpoId: lpoParentId,
					customerId: customerInternalId,
					jobId: lpoPlusJobId
				}
			};
			var firebaseUpdateURL =
				"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";
			apiHeaders["x-api-key"] =
				"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
			//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

			var response = https.request({
				method: https.Method.POST,
				url: firebaseUpdateURL,
				body: JSON.stringify(sendOutEmailJSON),
				headers: apiHeaders
			});

			var myresponse_body = response.body;
			var myresponse_code = response.code;

			log.debug({
				title: "myresponse_body",
				details: myresponse_body
			});

			log.debug({
				title: "myresponse_code",
				details: myresponse_code
			});

			//Send Email to LPO

			var emailToLPOSubject =
				"Job accepted  — " + business_name + " " + "(" + lpoPlusJobId + ")";

			//Send Email to End Customer
			var emailToLPOBody =
				"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}/* Reminder note — only appears for recurring */ .reminder-note { background: #EBF4FB; border-radius: 8px; padding: 16px 20px; margin: 24px 0; font-size: 14px; display: flex; gap: 14px; align-items: flex-start; } .reminder-note .icon { width: 32px; height: 32px; background: var(--navy); color: var(--amber-bright); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; font-weight: 700; } .reminder-note p { margin: 0; line-height: 1.55; } .reminder-note p strong { color: var(--navy); }.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head>";
			var year = new Date().getFullYear();
			//Email to LPO to let them know the job request has been accepted by the franchisee.

			emailToLPOBody +=
				'<body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">Job accepted by the franchisee.</div><p>Hello ' +
				lpoContactFirstName +
				",</p><p>The pickup you booked for " +
				business_name +
				" has been accepted by the courier team and is now active in your schedule.</p>";
			//Job Details Section
			emailToLPOBody +=
				'<div class="job-details"><div class="detail-row"><span class="detail-label">Reference:</span><span class="detail-value">' +
				lpoPlusJobId +
				'</span></div><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
				lpoPlusService +
				'</span></div><div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">' +
				prettyDate +
				'</span></div><div class="detail-row"><span class="detail-label">Franchisee:</span><span class="detail-value">' +
				partnerName +
				" (" +
				mainContactName +
				")</span></div></div>";

			emailToLPOBody +=
				"<p>The customer has been notified and will receive a reminder on the morning of each scheduled service day. You can track this job in your Job Manager at any time.</p><p>If the customer replies to their reminder email, our team will automatically route it to you.</p>";

			emailToLPOBody +=
				'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
				year +
				" lpo.plus. All rights reserved.</p></div></div></body></html>";

			var sendOutEmailJSON = {
				to: lpoEmail,
				cc: ["michael.mcdaid@mailplus.com.au", "kerry.oneill@mailplus.com.au"],
				subject: emailToLPOSubject,
				html: emailToLPOBody,
				metadata: {
					lpoId: lpoParentId,
					customerId: customerInternalId,
					jobId: lpoPlusJobId
				}
			};
			var firebaseUpdateURL =
				"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";
			apiHeaders["x-api-key"] =
				"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
			//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

			var response = https.request({
				method: https.Method.POST,
				url: firebaseUpdateURL,
				body: JSON.stringify(sendOutEmailJSON),
				headers: apiHeaders
			});

			var myresponse_body = response.body;
			var myresponse_code = response.code;

			log.debug({
				title: "myresponse_body",
				details: myresponse_body
			});

			log.debug({
				title: "myresponse_code",
				details: myresponse_code
			});

			//Send SMS
			// var accountSid = "ACc4fb93dc175b8f9066ed80bf0caecdb7";
			// var authToken = "7e1ef13535f1f7256eccf07581b01f12";
			// // Combine credentials
			// var rawString = accountSid + ":" + authToken;

			// // Encode to Base64
			// var base64Encoded = encode.convert({
			// 	string: rawString,
			// 	inputEncoding: encode.Encoding.UTF_8,
			// 	outputEncoding: encode.Encoding.BASE_64
			// });

			// var authHeader = "Basic " + base64Encoded;
			// var smsBody =
			// 	"Message from LPO.PLUS for " + business_name + " from " + lpoName;
			// smsBody += "\n\n" + message + "\n\n";
			// var apiResponse = https.post({
			// 	url: "	" + accountSid + "/Messages",
			// 	body: {
			// 		Body: smsBody,
			// 		To: partnerPhone,
			// 		From: "+61488883115"
			// 	},
			// 	headers: {
			// 		"Content-Type": "application/x-www-form-urlencoded",
			// 		Authorization: authHeader
			// 	}
			// });

			// log.debug({
			// 	title: "Twilio API Response",
			// 	details: JSON.stringify(apiResponse)
			// });

			var returnObj = {
				success: true,
				message: "Message sent by the operator."
			};

			log.audit({
				title: "Final Return",
				details: JSON.stringify(returnObj)
			});
			_sendJSResponse(context.request, context.response, returnObj);
		}
	}

	function _sendJSResponse(request, response, respObject) {
		// response.setContentType("JAVASCRIPT");
		response.setHeader("Access-Control-Allow-Origin", "*");
		var callbackFcn = request.jsoncallback || request.callback;
		if (callbackFcn) {
			response.writeLine({
				output: callbackFcn + "(" + JSON.stringify(respObject) + ");"
			});
		} else response.writeLine({ output: JSON.stringify(respObject) });
	}

	function getDateStoreNS() {
		var date = new Date();
		if (date.getHours() > 6) {
			date.setDate(date.getDate() + 1);
		}

		format.format({
			value: date,
			type: format.Type.DATE,
			timezone: format.Timezone.AUSTRALIA_SYDNEY
		});

		return date;
	}

	function getStateId(state) {
		var state_id;

		switch (state) {
			case "NSW":
				state_id = 1;
				break;
			case "QLD":
				state_id = 2;
				break;
			case "VIC":
				state_id = 3;
				break;
			case "SA":
				state_id = 4;
				break;
			case "TAS":
				state_id = 5;
				break;
			case "ACT":
				state_id = 6;
				break;
			case "WA":
				state_id = 7;
				break;
			case "NT":
				state_id = 8;
				break;
			case "NZ":
				state_id = 9;
				break;
		}

		return state_id;
	}

	function areDatesEqual(dateStr1, dateStr2) {
		// Expects both dates in "YYYY-MM-DD" format
		return dateStr1 === dateStr2;
	}

	/**
	 * @description Function to check if a service exists in the service list.
	 * @author Ankith Ravindran (AR)
	 * @date 17/06/2025
	 * @param {*} data
	 * @param {*} service
	 * @returns {*}
	 */
	function getServiceRate(serviceList, serviceName) {
		// serviceList: array of objects with 'name' and 'rate' properties
		// serviceName: string to check (case-insensitive)
		for (var i = 0; i < serviceList.length; i++) {
			if (serviceList[i].name == serviceName) {
				return { rate: serviceList[i].rate, id: serviceList[i].id };
			}
		}
		return null; // Not found
	}

	function pad(s) {
		return s < 10 ? "0" + s : s;
	}

	function getOrdinalSuffix(day) {
		if (day % 100 >= 11 && day % 100 <= 13) {
			return "th";
		}

		switch (day % 10) {
			case 1:
				return "st";
			case 2:
				return "nd";
			case 3:
				return "rd";
			default:
				return "th";
		}
	}

	function formatDateToLongReadable(dateStr) {
		if (isNullorEmpty(dateStr)) {
			return "";
		}

		var parts = dateStr.split("-");
		if (parts.length !== 3) {
			return dateStr;
		}

		var year = parseInt(parts[0], 10);
		var monthIndex = parseInt(parts[1], 10) - 1;
		var day = parseInt(parts[2], 10);

		if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) {
			return dateStr;
		}

		var weekdayNames = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday"
		];

		var monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		];

		// Use UTC to avoid timezone shifts that can change weekday/date unexpectedly.
		var parsedDate = new Date(Date.UTC(year, monthIndex, day));
		var weekday = weekdayNames[parsedDate.getUTCDay()];
		var month = monthNames[monthIndex];

		if (isNullorEmpty(weekday) || isNullorEmpty(month)) {
			return dateStr;
		}

		return (
			weekday + ", " + day + getOrdinalSuffix(day) + " " + month + " " + year
		);
	}

	function isNullorEmpty(strVal) {
		return (
			strVal == null ||
			strVal == "" ||
			strVal == "null" ||
			strVal == undefined ||
			strVal == "undefined" ||
			strVal == "- None -" ||
			strVal == " "
		);
	}

	function arrayOfStringsToIntegers(arr) {
		var result = [];
		for (var i = 0; i < arr.length; i++) {
			var num = parseInt(arr[i], 10);
			if (!isNaN(num)) {
				result.push(num);
			}
		}
		return result;
	}

	function isArrayAlt(variable) {
		return Array.isArray
			? Array.isArray(variable)
			: Object.prototype.toString.call(variable) === "[object Array]";
	}

	return {
		onRequest: onRequest
	};
});
