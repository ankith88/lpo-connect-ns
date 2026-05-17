/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *

 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 28 2026
 * Modified on:          Tue Apr 28 2026 11:28:04
 * SuiteScript Version:   
 * Description:          Suitelet used to send out notifications on declining the job request from LPO.PLUS application 
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
	"N/https"
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
	https
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

			//{"reason":"No Capacity Today","notes":"Cannot perform the job at the time requested","compid":"1048144","lpo_id":"1974139","ns-at":"AAEJ7tMQboW4e_4uOdEOkAJSDSB2d-67rLJ9FX2eFCl6Rfo5vSY","action":"reject","customer_id":"1994558","request_id":"SnudqEWlieBXFT6m5bRb","script":"2532","deploy":"1"}

			var customerInternalId = context.request.parameters.customer_id;
			var lpoParentCustomerInternalID = context.request.parameters.lpo_id;
			var requestId = context.request.parameters.request_id;

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
			var partnerContactName = customerPartnerRecord.getValue({
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

			var lpoParentCustomerRecord = record.load({
				type: record.Type.CUSTOMER,
				id: lpoParentCustomerInternalID
			});
			var lpoName = lpoParentCustomerRecord.getValue({
				fieldId: "companyname"
			});
			var lpoEmail = lpoParentCustomerRecord.getValue({
				fieldId: "email"
			});
			var lpoPhone = lpoParentCustomerRecord.getValue({
				fieldId: "phone"
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
					values: lpoParentCustomerInternalID
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

			//Send Email to LPO when job has been declined by the operator for the day.
			if (!isNullorEmpty(lpoEmail)) {
				var emailToLPOSubject =
					"Job Request Declined for " + business_name + " - " + requestId;

				//Send Email to End Customer
				var emailToLPOBody =
					"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}/* Reminder note — only appears for recurring */ .reminder-note { background: #EBF4FB; border-radius: 8px; padding: 16px 20px; margin: 24px 0; font-size: 14px; display: flex; gap: 14px; align-items: flex-start; } .reminder-note .icon { width: 32px; height: 32px; background: var(--navy); color: var(--amber-bright); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; font-weight: 700; } .reminder-note p { margin: 0; line-height: 1.55; } .reminder-note p strong { color: var(--navy); }.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head>";
				var year = new Date().getFullYear();
				//Email to LPO to let them know the job request has been declined by the operator.

				emailToLPOBody +=
					'<body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">Job Request Declined</div><p>Hello ' +
					lpoContactFirstName +
					",</p><p>The Job Request for " +
					business_name +
					" pickup has been declined.</p>";
				//Job Details Section
				emailToLPOBody +=
					'<div class="job-details"><div class="detail-row"><span class="detail-label">Reference:</span><span class="detail-value">' +
					requestId +
					"</span></div>";
				emailToLPOBody += "</div>";
				emailToLPOBody +=
					"<p>Please contact Kerry or your franchise representative for further assistance.</p>";
				//Franchisee Details Section
				emailToLPOBody += '<div class="job-details">';
				emailToLPOBody +=
					'<div class="detail-row"><span class="detail-label">Franchisee Name:</span><span class="detail-value">' +
					partnerName +
					"</span></div>";
				emailToLPOBody +=
					'<div class="detail-row"><span class="detail-label">Franchisee Contact Name:</span><span class="detail-value">' +
					partnerContactName +
					"</span></div>";
				emailToLPOBody +=
					'<div class="detail-row"><span class="detail-label">Franchisee Number:</span><span class="detail-value">' +
					partnerNumber +
					"</span></div>";
				emailToLPOBody +=
					'<div class="detail-row"><span class="detail-label">Franchisee Email:</span><span class="detail-value">' +
					partnerEmail +
					"</span></div>";
				emailToLPOBody += "</div>";
				emailToLPOBody +=
					"<p>Thanks for choosing your local Licensed Post Office.</p>";

				emailToLPOBody +=
					'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
					year +
					" lpo.plus. All rights reserved.</p></div></div></body></html>";

				var sendOutEmailJSON = {
					to: lpoEmail,
					cc: [
						"michael.mcdaid@mailplus.com.au",
						"kerry.oneill@mailplus.com.au"
					],
					subject: emailToLPOSubject,
					html: emailToLPOBody,
					metadata: {
						lpoId: lpoParentCustomerInternalID,
						customerId: customerInternalId,
						jobId: requestId
					}
				};
				var firebaseUpdateURL =
					"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

				var apiHeaders = {};
				apiHeaders["Content-Type"] = "application/json";
				apiHeaders["x-api-key"] =
					"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
				//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

				var responseToLPO = https.request({
					method: https.Method.POST,
					url: firebaseUpdateURL,
					body: JSON.stringify(sendOutEmailJSON),
					headers: apiHeaders
				});

				var myresponseToLPO_body = responseToLPO.body;
				var myresponseToLPO_code = responseToLPO.code;

				log.debug({
					title: "myresponseToLPO_body",
					details: myresponseToLPO_body
				});

				log.debug({
					title: "myresponseToLPO_code",
					details: myresponseToLPO_code
				});
			}

			//Send out sms to LPO when job has been declined by the operator for the day.
			if (!isNullorEmpty(lpoPhone)) {
				lpoPhone = lpoPhone.replace(/ /g, "");
				lpoPhone = lpoPhone.slice(1);
				lpoPhone = "+61" + lpoPhone;

				var smsBody =
					"Dear " +
					lpoName +
					", we would like to inform you that the job request for " +
					business_name +
					" with Job ID: " +
					requestId +
					" has been declined by the operator for the day. Please check your email for more details. - MailPlus Team";

				var apiResponse = https.post({
					url: "https://api.twilio.com/2010-04-01/Accounts/ACc4fb93dc175b8f9066ed80bf0caecdb7/Messages",
					body: {
						Body: smsBody,
						To: lpoPhone,
						From: "+61488883115"
					},
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Authorization:
							"Basic QUNjNGZiOTNkYzE3NWI4ZjkwNjZlZDgwYmYwY2FlY2RiNzo3ZTFlZjEzNTM1ZjFmNzI1NmVjY2YwNzU4MWIwMWYxMg=="
					}
				});
			}

			//Send email to end customer to let them know the job request has been declined by the operator.
			if (!isNullorEmpty(customerContactEmail)) {
				var emailToCustomerSubject =
					"Job Request Declined for " + business_name + " - " + requestId;

				var emailToCustomerBody =
					"Dear " +
					business_name +
					",<br><br>We regret to inform you that the job request with reference ID: " +
					requestId +
					" has been declined by the operator for the day. Please contact your local Post Office or Kerry/Michael for further assistance.<br><br>Thank you for your understanding.<br><br>Best regards,<br>MailPlus Team";

				//Send Email to End Customer
				var emailToCustomerBody =
					"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}/* Reminder note — only appears for recurring */ .reminder-note { background: #EBF4FB; border-radius: 8px; padding: 16px 20px; margin: 24px 0; font-size: 14px; display: flex; gap: 14px; align-items: flex-start; } .reminder-note .icon { width: 32px; height: 32px; background: var(--navy); color: var(--amber-bright); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; font-weight: 700; } .reminder-note p { margin: 0; line-height: 1.55; } .reminder-note p strong { color: var(--navy); }.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head>";
				var year = new Date().getFullYear();
				//Email to LPO to let them know the job request has been declined by the operator.

				emailToCustomerBody +=
					'<body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">Job Request Declined</div><p>Hello ' +
					customerContactFirstName +
					",</p><p>We regret to inform you that the job request with reference ID: " +
					requestId +
					" has been declined by the operator. Please contact your local Post Office for further assistance.</p>";
				//Job Details Section
				emailToCustomerBody +=
					'<div class="job-details"><div class="detail-row"><span class="detail-label">Reference:</span><span class="detail-value">' +
					requestId +
					"</span></div>";
				emailToCustomerBody += "</div>";

				emailToCustomerBody +=
					'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
					year +
					" lpo.plus. All rights reserved.</p></div></div></body></html>";

				var sendOutEmailJSON = {
					to: customerContactEmail,
					subject: emailToCustomerSubject,
					html: emailToCustomerBody,
					metadata: {
						lpoId: lpoParentCustomerInternalID,
						customerId: customerInternalId,
						jobId: requestId
					}
				};
				var firebaseUpdateURL =
					"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

				var apiHeaders = {};
				apiHeaders["Content-Type"] = "application/json";
				apiHeaders["x-api-key"] =
					"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
				//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

				var responseToLPO = https.request({
					method: https.Method.POST,
					url: firebaseUpdateURL,
					body: JSON.stringify(sendOutEmailJSON),
					headers: apiHeaders
				});

				var myresponseToLPO_body = responseToLPO.body;
				var myresponseToLPO_code = responseToLPO.code;

				log.debug({
					title: "myresponseToLPO_body",
					details: myresponseToLPO_body
				});

				log.debug({
					title: "myresponseToLPO_code",
					details: myresponseToLPO_code
				});
			}

			var returnObj = {
				success: true,
				message: "Message sent by the LPO & Kerry/Michael."
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
