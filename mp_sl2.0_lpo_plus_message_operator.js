/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Fri May 01 2026
 * Modified on:          Fri May 01 2026 10:21:03
 * SuiteScript Version:  2.0
 * Description:           SuiteLet to send email and SMS to operators and franchisees when user clicks "Message Operator" button in LPO.PLUS.
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

			//{"netsuiteCustomerId":"1996096","compid":"1048144","appJobGroupId":"21165009","lpo_id":"1974139","ns-at":"AAEJ7tMQeYW40giJlU7O2McXMAA-MKOcrvoW29VOHNRcMiaQ7AM","document_id":"y9BcMxvWuOSGcoAmf0rq","message":"This is a test message","script":"2535","deploy":"1"}

			var lpoPlusJobId = context.request.parameters.document_id;
			var lpoParentId = context.request.parameters.lpo_id;

			var lpoParentCustomerRecord = record.load({
				type: record.Type.CUSTOMER,
				id: lpoParentId
			});
			var lpoName = lpoParentCustomerRecord.getValue({
				fieldId: "companyname"
			});
			var lpoNameArray = lpoName.split(" - ");
			lpoName = lpoNameArray[0].trim();

			var appJobGroupId = context.request.parameters.appJobGroupId;
			var message = context.request.parameters.message;

			var customerInternalId = context.request.parameters.netsuiteCustomerId;
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

			var customerPartnerRecord = record.load({
				type: "partner",
				id: partnerID
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

			//Send email to franchisee owner with the message from the user with the details of the job request

			// var emailSubject =
			// 	"Message from LPO.PLUS for " + business_name + " from " + lpoName;
			// var emailBody =
			// 	"Below is the message from LPO.PLUS for " +
			// 	business_name +
			// 	":\n\n" +
			// 	message +
			// 	"\n\n";

			// // Send email to franchisee owner
			// email.send({
			// 	author: 112209,
			// 	recipients: partnerEmail,
			// 	subject: emailSubject,
			// 	body: emailBody,
			// 	bcc: ["dispatcher@mailplus.com.au", "customerservice@mailplus.com.au"],
			// 	relatedRecords: { entityId: customerInternalId }
			// });

			var emailBody =
				"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}</style></head>";
			var year = new Date().getFullYear();
			//Email to LPO to let them know the job request has been accepted by the franchisee.

			emailBody +=
				'</head><body><div class="email-container"><div class="header"><h1>LPO<span>.PLUS</span></h1></div><div class="content"><div class="greeting">Message from LPO.PLUS</div><p>Hi ' +
				mainContactName +
				"</p><p>Below is the message for customer," +
				business_name +
				", sent by the LPO: " +
				lpoName +
				".</p><p>" +
				message +
				'</p><div class="status-box"></div><p style="font-size:14px;color:#666;">Please contact LPO.PLUS for further assistance.</p></div>';

			emailBody +=
				'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
				year +
				" lpo.plus. All rights reserved.</p></div></div></body></html>";

			var sendOutEmailJSON = {
				to: partnerEmail,
				cc: ["michael.mcdaid@mailplus.com.au", "kerry.oneill@mailplus.com.au"],
				subject: emailSubject,
				html: emailBody,
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
			var accountSid = "ACc4fb93dc175b8f9066ed80bf0caecdb7";
			var authToken = "7e1ef13535f1f7256eccf07581b01f12";
			// Combine credentials
			var rawString = accountSid + ":" + authToken;

			// Encode to Base64
			var base64Encoded = encode.convert({
				string: rawString,
				inputEncoding: encode.Encoding.UTF_8,
				outputEncoding: encode.Encoding.BASE_64
			});

			var authHeader = "Basic " + base64Encoded;
			var smsBody =
				"Message from LPO.PLUS for " + business_name + " from " + lpoName;
			smsBody += "\n\n" + message + "\n\n";
			var apiResponse = https.post({
				url: "	" + accountSid + "/Messages",
				body: {
					Body: smsBody,
					To: partnerPhone,
					From: "+61488883115"
				},
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: authHeader
				}
			});

			log.debug({
				title: "Twilio API Response",
				details: JSON.stringify(apiResponse)
			});

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
