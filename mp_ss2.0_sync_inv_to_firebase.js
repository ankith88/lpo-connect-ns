/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 *
 * Author:               Ankith Ravindran
 * Created on:           Thu May 21 2026
 * Modified on:          Thu May 21 2026 08:36:13
 * SuiteScript Version:  2.0
 * Description:          Sync Invoices to LPO.PLUS from NetSuite
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */

define([
	"N/task",
	"N/email",
	"N/runtime",
	"N/search",
	"N/record",
	"N/format",
	"N/https"
], function (task, email, runtime, search, record, format, https) {
	var main_JSON = "";
	var lpoName = "";
	var lpoContactFName = null;
	var lpoContactLName = null;
	var lpoContactEmail = null;
	var lpoContactPhone = null;

	function execute(context) {
		//GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
		var tokenBody =
			'{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

		var apiHeaders = {};
		apiHeaders["Content-Type"] = "application/json";

		var responseAccessToken = https.request({
			method: https.Method.POST,
			url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs",
			headers: apiHeaders,
			body: tokenBody
		});

		log.debug({
			title: "Firebase Access Token Response",
			details: responseAccessToken.body
		});

		var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

		var idToken = responseAccessTokenObj.idToken;
		// idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
		var refreshToken = responseAccessTokenObj.refreshToken;

		//Search: LPO.PLUS - Invoice List
		var lpoplusInvoiceListSearch = search.load({
			type: "customer",
			id: "customsearch_lpo_plus_invoice_list"
		});

		var resultSetLPOPlusInvoiceList = lpoplusInvoiceListSearch.run();

		var oldInvoiceNumber = "";
		var oldInvoiceInternalId = "";
		var invoiceCounter = 0;
		var oldParentLPOInternalId = "";
		var oldCustomerName = "";
		var oldFormattedInvoiceDate = "";
		var oldBillingMonth = "";
		var oldInvoiceAmount = 0;
		var lineItems = "";
		var oldInvoiceStatus = "";
		var oldCustomerInternalId = "";

		resultSetLPOPlusInvoiceList.each(function (searchResult) {
			//PArent LPO
			var parentLPOInternalId = searchResult.getValue({
				name: "custentity_lpo_parent_account",
				join: "parentCustomer"
			});

			//Customer Details
			var customerInternalId = searchResult.getValue({
				name: "internalid"
			});
			var customerName = searchResult.getValue({
				name: "companyname"
			});
			var customerZee = searchResult.getValue({
				name: "partner"
			});

			//Invoice Details
			var invoiceDate = searchResult.getValue({
				name: "trandate",
				join: "transaction"
			});

			//Get formatted  date and billing month
			var parsedDate = parseDateAndBillingMonth(invoiceDate);
			var formattedInvoiceDate = parsedDate.formatted;
			var billingMonth = parsedDate.billingMonth;

			var invoiceInternalId = searchResult.getValue({
				name: "internalid",
				join: "transaction"
			});
			var invoiceNumber = searchResult.getValue({
				name: "tranid",
				join: "transaction"
			});
			var invoiceItem = searchResult.getText({
				name: "item",
				join: "transaction"
			});
			if (invoiceItem == 'Outoging Mail Lodgement') {
				invoiceItem = 'Site-to-LPO';
			} else if (invoiceItem == 'Pick up and Delivery from PO') {
				invoiceItem = 'LPO-to-Site';
			} else if (invoiceItem == 'Package: Pickup from PO & Lodge Outgoing Mail') { 
				invoiceItem = 'Round Trip';
			}
			
			var invoiceItemDetails = searchResult.getText({
				name: "custcol1",
				join: "transaction"
			});
			var invoiceItemRate = searchResult.getValue({
				name: "rate",
				join: "transaction"
			});
			var invoiceItemQuantity = searchResult.getValue({
				name: "quantity",
				join: "transaction"
			});
			var invoiceItemAmount = searchResult.getValue({
				name: "amount",
				join: "transaction"
			});
			var invoiceAmount = searchResult.getValue({
				name: "total",
				join: "transaction"
			});
			var invoiceStatus = searchResult.getText({
				name: "statusref",
				join: "transaction"
			});

			//Log all the above fields for debugging purposes
			log.audit({
				title: "Invoice Details",
				details: {
					parentLPOInternalId: parentLPOInternalId,
					customerInternalId: customerInternalId,
					customerName: customerName,
					customerZee: customerZee,
					invoiceDate: invoiceDate,
					formattedInvoiceDate: formattedInvoiceDate,
					billingMonth: billingMonth,
					invoiceNumber: invoiceNumber,
					invoiceItem: invoiceItem,
					invoiceItemDetails: invoiceItemDetails,
					invoiceItemRate: invoiceItemRate,
					invoiceItemQuantity: invoiceItemQuantity,
					invoiceItemAmount: invoiceItemAmount,
					invoiceAmount: invoiceAmount
				}
			});

			/** 
			 * Sample Line Items JSON structure to be sent to Firebase:
			 * {
				"itemId": "ITEM-0019",
				"description": "Standard Consignment Processing Base Rate",
				"rate": 1.20,
				"quantity": 1000,
				"amount": 1200.00
				},
			*/

			//Check if the invoice exists

			if (invoiceCounter == 0) {
				lineItems += '{"mapValue": {"fields": {';
				lineItems += '"itemId": {"stringValue": "' + invoiceItem + '"},';
				lineItems +=
					'"description": {"stringValue": "' + invoiceItemDetails + '"},';
				lineItems += '"rate": {"doubleValue": ' + invoiceItemRate + "},";
				lineItems +=
					'"quantity": {"doubleValue": ' + invoiceItemQuantity + "},";
				lineItems += '"amount": {"doubleValue": ' + invoiceItemAmount + "}";
				lineItems += "}}},";
				log.audit({
					title: "First Line Item Added",
					details: lineItems
				});
			} else if (invoiceNumber == oldInvoiceNumber) {
				lineItems += '{"mapValue": {"fields": {';
				lineItems += '"itemId": {"stringValue": "' + invoiceItem + '"},';
				lineItems +=
					'"description": {"stringValue": "' + invoiceItemDetails + '"},';
				lineItems += '"rate": {"doubleValue": ' + invoiceItemRate + "},";
				lineItems +=
					'"quantity": {"doubleValue": ' + invoiceItemQuantity + "},";
				lineItems += '"amount": {"doubleValue": ' + invoiceItemAmount + "}";
				lineItems += "}}},";
				log.audit({
					title: "Line Item Added",
					details: lineItems
				});
			} else if (invoiceNumber != oldInvoiceNumber) {
				log.debug({
					title: "lineItems",
					details:
						"Invoice Number: " + oldInvoiceNumber + ", Line Items: " + lineItems
				});

				if (lineItems.slice(-1) == ",") {
					lineItems = lineItems.slice(0, -1);
				}

				var invoiceDetails = '{"fields": {';
				invoiceDetails +=
					'"lpoId": {"stringValue": "' + oldParentLPOInternalId + '"},';
				invoiceDetails +=
					'"customerId": {"stringValue": "' + oldCustomerInternalId + '"},';
				invoiceDetails +=
					'"customerName": {"stringValue": "' + oldCustomerName + '"},';
				invoiceDetails +=
					'"invoiceNum": {"stringValue": "' + oldInvoiceNumber + '"},';
				invoiceDetails +=
					'"date": {"stringValue": "' + oldFormattedInvoiceDate + '"},';
				invoiceDetails +=
					'"billingMonth": {"stringValue": "' + oldBillingMonth + '"},'; // YYYY-MM
				invoiceDetails +=
					'"totalAmount": {"doubleValue": ' +
					parseFloat(oldInvoiceAmount) +
					"},";
				invoiceDetails += '"line_items": {"arrayValue": {"values": [';
				invoiceDetails += lineItems;
				invoiceDetails += "]}},"; // Close arrayValue
				invoiceDetails +=
					'"status": {"stringValue": "' + oldInvoiceStatus + '"}';
				invoiceDetails += "}}"; // Close fields and root object
				log.debug({
					title: "Constructed JSON for Firebase",
					details: invoiceDetails
				});

				//Check if the invoice exists
				var firebaseLPOInvoiceURL =
					"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
					oldParentLPOInternalId +
					"/invoices/" +
					oldInvoiceInternalId;

				var apiHeaders = {};
				apiHeaders["Content-Type"] = "application/json";
				apiHeaders["Accept"] = "*/*";
				apiHeaders["Authorization"] = "Bearer " + idToken;

				var responseLPOInvoiceDocument = https.request({
					method: https.Method.GET,
					url: firebaseLPOInvoiceURL,
					headers: apiHeaders
				});

				var dbLPOInvoiceBody = responseLPOInvoiceDocument.body;

				log.audit({
					title: "LPO Invoice Firebase Data",
					details: dbLPOInvoiceBody
				});

				var responseLPOInvoiceObj = JSON.parse(dbLPOInvoiceBody);

				if (isNullorEmpty(responseLPOInvoiceObj.fields)) {
					log.audit({
						title: "Invoice does not exist in Firebase",
						details: "Creating new invoice document in Firebase"
					});

					var urlCreateLPOInvoice =
						"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
						oldParentLPOInternalId +
						"/invoices?documentId=" +
						oldInvoiceInternalId;

					var headerObj = {
						name: "Content-Type",
						value: "application/json"
					};

					// Send invoiceDetails to Firebase using HTTPS POST request
					var responseCreateInvoice = https.post({
						url: urlCreateLPOInvoice,
						body: invoiceDetails,
						headers: headerObj
					});

					log.debug({
						title: "Firebase Response",
						details: responseCreateInvoice.body
					});
				} else {
					log.audit({
						title: "Invoice already exists in Firebase",
						details: "No action taken for invoice document in Firebase"
					});
				}

				recInvoice = record.load({
					type: record.Type.INVOICE,
					id: oldInvoiceInternalId,
					isDynamic: true
				});
				recInvoice.setValue({
					fieldId: "custbody_synced_with_firebase",
					value: 1
				});
				recInvoice.save();

				//Reset line items for new invoice
				lineItems = "";
				oldInvoiceAmount = 0;
				oldCustomerName = "";
				oldFormattedInvoiceDate = "";
				oldBillingMonth = "";
				oldParentLPOInternalId = "";

				lineItems += '{"mapValue": {"fields": {';
				lineItems += '"itemId": {"stringValue": "' + invoiceItem + '"},';
				lineItems +=
					'"description": {"stringValue": "' + invoiceItemDetails + '"},';
				lineItems += '"rate": {"doubleValue": ' + invoiceItemRate + "},";
				lineItems +=
					'"quantity": {"doubleValue": ' + invoiceItemQuantity + "},";
				lineItems += '"amount": {"doubleValue": ' + invoiceItemAmount + "}";
				lineItems += "}}},";
			}

			oldInvoiceInternalId = invoiceInternalId;
			oldInvoiceNumber = invoiceNumber;
			oldCustomerName = customerName;
			oldFormattedInvoiceDate = formattedInvoiceDate;
			oldBillingMonth = billingMonth;
			oldInvoiceAmount = invoiceAmount;
			oldParentLPOInternalId = parentLPOInternalId;
			oldInvoiceStatus = invoiceStatus;
			oldCustomerInternalId = customerInternalId;
			invoiceCounter++;
			return true;
		});

		if (invoiceCounter > 0) {
			log.debug({
				title: "lineItems",
				details:
					"Invoice Number: " + oldInvoiceNumber + ", Line Items: " + lineItems
			});

			if (lineItems.slice(-1) == ",") {
				lineItems = lineItems.slice(0, -1);
			}

			var invoiceDetails = '{"fields": {';
			invoiceDetails +=
				'"lpoId": {"stringValue": "' + oldParentLPOInternalId + '"},';
			invoiceDetails +=
				'"customerId": {"stringValue": "' + oldCustomerInternalId + '"},';
			invoiceDetails +=
				'"customerName": {"stringValue": "' + oldCustomerName + '"},';
			invoiceDetails +=
				'"invoiceNum": {"stringValue": "' + oldInvoiceNumber + '"},';
			invoiceDetails +=
				'"date": {"stringValue": "' + oldFormattedInvoiceDate + '"},';
			invoiceDetails +=
				'"billingMonth": {"stringValue": "' + oldBillingMonth + '"},'; // YYYY-MM
			invoiceDetails +=
				'"totalAmount": {"doubleValue": ' + parseFloat(oldInvoiceAmount) + "},";
			invoiceDetails += '"line_items": {"arrayValue": {"values": [';
			invoiceDetails += lineItems;
			invoiceDetails += "]}},"; // Close arrayValue
			invoiceDetails += '"status": {"stringValue": "' + oldInvoiceStatus + '"}';
			invoiceDetails += "}}"; // Close fields and root object

			log.debug({
				title: "Constructed JSON for Firebase",
				details: invoiceDetails
			});

			//Check if the invoice exists
			var firebaseLPOInvoiceURL =
				"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
				oldParentLPOInternalId +
				"/invoices/" +
				oldInvoiceInternalId;

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";
			apiHeaders["Accept"] = "*/*";
			apiHeaders["Authorization"] = "Bearer " + idToken;

			var responseLPOInvoiceDocument = https.request({
				method: https.Method.GET,
				url: firebaseLPOInvoiceURL,
				headers: apiHeaders
			});

			var dbLPOInvoiceBody = responseLPOInvoiceDocument.body;

			var responseLPOInvoiceObj = JSON.parse(dbLPOInvoiceBody);

			if (isNullorEmpty(responseLPOInvoiceObj.fields)) {
				log.audit({
					title: "Invoice does not exist in Firebase",
					details: "Creating new invoice document in Firebase"
				});
				var urlCreateLPOInvoice =
					"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
					oldParentLPOInternalId +
					"/invoices?documentId=" +
					oldInvoiceInternalId;

				var headerObj = {
					name: "Content-Type",
					value: "application/json"
				};

				// Send invoiceDetails to Firebase using HTTPS POST request
				var responseCreateInvoice = https.post({
					url: urlCreateLPOInvoice,
					body: invoiceDetails,
					headers: headerObj
				});

				log.debug({
					title: "Firebase Response",
					details: responseCreateInvoice.body
				});
			} else {
				log.audit({
					title: "Invoice already exists in Firebase",
					details: "No action taken for invoice document in Firebase"
				});
			}

			recInvoice = record.load({
				type: record.Type.INVOICE,
				id: oldInvoiceInternalId,
				isDynamic: true
			});
			recInvoice.setValue({
				fieldId: "custbody_synced_with_firebase",
				value: 1
			});
			recInvoice.save();
		}
	}
	return {
		execute: execute
	};

	function getDateStoreNS() {
		var date = new Date();
		// if (date.getHours() > 6) {
		//     date.setDate(date.getDate() + 1);
		// }

		format.format({
			value: date,
			type: format.Type.DATE,
			timezone: format.Timezone.AUSTRALIA_SYDNEY
		});

		return date;
	}

	// Shuffle dialers for initial randomness
	function shuffle(array) {
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
	}

	function removeDuplicates(arr) {
		var unique = [];
		for (var i = 0; i < arr.length; i++) {
			if (unique.indexOf(arr[i]) === -1) {
				unique.push(arr[i]);
			}
		}
		return unique;
	}

	// Pure JavaScript padStart implementation
	function padStartCustom(str, targetLength, padString) {
		str = String(str);
		padString = padString || " ";
		if (str.length >= targetLength) return str;
		var pad = "";
		while (pad.length < targetLength - str.length) {
			pad += padString;
		}
		pad = pad.slice(0, targetLength - str.length);
		return pad + str;
	}

	// Converts '1/5/2026' to 'YYYY-MM-DD' and gets billing month as 'YYYY-MM' (no moment.js)
	function parseDateAndBillingMonth(dateStr) {
		// Split by '/'
		var parts = dateStr.split("/");
		if (parts.length !== 3) return { formatted: "", billingMonth: "" };
		var day = padStartCustom(parts[0], 2, "0");
		var month = padStartCustom(parts[1], 2, "0");
		var year = parts[2];
		var formatted = year + "-" + month + "-" + day;
		var billingMonth = year + "-" + month;
		return { formatted: formatted, billingMonth: billingMonth };
	}

	/**
	 * Is Null or Empty.
	 *
	 * @param {Object} strVal
	 */
	function isNullorEmpty(strVal) {
		return (
			strVal == null ||
			strVal == "" ||
			strVal == "null" ||
			strVal == undefined ||
			strVal == "undefined" ||
			strVal == "- None -"
		);
	}
});
