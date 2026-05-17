/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 21 2026
 * Modified on:          Tue Apr 21 2026 12:21:29
 * SuiteScript Version:  2.0
 * Description:          Suitelet used to send out the request to the franchisee owner of a new job request from the LPO.
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
		var year = date.getFullYear();
		var month = pad(date.getMonth() + 1);
		var day = pad(date.getDate());
		var todayDate = year + "-" + month + "-" + day;
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

			//{"compid":"1048144","lpo_id":"1974139","ns-at":"AAEJ7tMQM_E8dKF2qjDMy9ESy5q883g7xrb8uKwfgGOku62wheU","customer_id":"1993911","request_id":"mbq5xNZggC79fmYIOzNc","script":"2528","deploy":"1"}

			var jobRequestId = context.request.parameters.request_id;
			var lpoInternalId = context.request.parameters.lpo_id;
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
			var parentCompanyInternalId = customerRecord.getValue({
				fieldId: "parent"
			});

			var parentCustomerRecord = record.load({
				type: "customer",
				id: parentCompanyInternalId
			});

			var lpoLinkedZees = parentCustomerRecord.getValue({
				fieldId: "custentity_lpo_linked_franchisees"
			});

			var lpoLinkedZeesArray = [];
			if (!isNullorEmpty(lpoLinkedZees)) {
				lpoLinkedZees = lpoLinkedZees.toString();
				log.debug({
					title: "lpoLinkedZees",
					details: lpoLinkedZees
				});
				if (lpoLinkedZees.indexOf(",") != -1) {
					lpoLinkedZeesArray = lpoLinkedZees.split(",");
				} else {
					lpoLinkedZeesArray = [];
					lpoLinkedZeesArray.push(lpoLinkedZees);
				}
			}
			log.debug({
				title: "lpoLinkedZeesArray",
				details: lpoLinkedZeesArray
			});

			for (var i = 0; i < lpoLinkedZeesArray.length; i++) {
				var customerPartnerRecord = record.load({
					type: "partner",
					id: lpoLinkedZeesArray[i]
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

				var jobRequestPageURL =
					"https://lpo.plus/request/" + context.request.parameters.request_id + "?zee=" + lpoLinkedZeesArray[i];

				var emailSubject = "New Job Request for " + business_name;
				// var emailBody =
				// 	"You have received a new job request for " +
				// 	business_name +
				// 	". Please click the link below to view the details of the request and accept or reject it. \n\n" +
				// 	jobRequestPageURL;

				var emailBody =
					"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}</style>";
				emailBody +=
					'</head><body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">New Job Request Received</div><p>Hello ' +
					mainContactName +
					",</p><p>A new job request has been submitted for <strong>" +
					business_name +
					'</strong> and is currently awaiting your review.</p><div class="action-box"><p style="margin-top:0;color:#095c7b;font-weight:600;">Action Required:</p><p>Please follow the link below to view the full job details. You will need to:</p><ul style="padding-left:20px;"><li><strong>Accept</strong> the request to add it to your manifest.</li><li><strong>Decline</strong> the job if it cannot be fulfilled.</li><li><strong>Propose a new time</strong> if the requested service time is unavailable</li></ul></div><p>You can also use the integrated portal to <strong>chat directly with the LPO</strong> regarding any specific logistics or instructions for this request.</p><div class="button-container"><a href="' +
					jobRequestPageURL +
					'" class="btn-primary"> View Request & Chat </a></div><p style="font-size:14px;color:#666;">This request was generated via your unique booking link to ensure seamless coordination</p></div>';
				emailBody +=
					'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
					year +
					" lpo.plus. All rights reserved.</p></div></div></body></html>";

				// Send email to franchisee owner
				// email.send({
				// 	author: 112209,
				// 	recipients: partnerEmail,
				// 	subject: emailSubject,
				// 	body: emailBody,
				// 	bcc: ["dispatcher@mailplus.com.au", "customerservice@mailplus.com.au"],
				// 	relatedRecords: { entityId: customerInternalId }
				// });

				//Send Email using bookings@lpo.plus domain using the LPO.PLUS Application API.
				var sendOutEmailJSON = {
					to: partnerEmail,
					cc: "",
					subject: emailSubject,
					html: emailBody,
					metadata: {
						lpoId: lpoInternalId,
						customerId: customerInternalId,
						jobId: jobRequestId
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

				log.audit({
					title: 'Email sent to franchisee owner at ' + partnerEmail,
					details: 'Response Body: ' + myresponse_body + ', Response Code: ' + myresponse_code
				})

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
				// var smsBody = "New Job Request for " + business_name;
				// smsBody +=
				// 	"You have received a new job request for " +
				// 	business_name +
				// 	". Please click the link below to view the details of the request and accept or reject it. \n\n" +
				// 	jobRequestPageURL;
				// var apiResponse = https.post({
				// 	url:
				// 		"https://api.twilio.com/2010-04-01/Accounts/" +
				// 		accountSid +
				// 		"/Messages",
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
			}
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
