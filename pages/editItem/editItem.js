// pages/addItem/addItem.js
const g_app = getApp();
var g_companyCodeMap = [];
var g_isEdit = false;
var g_itemID = 0;
Page({
	/**
	 * 页面的初始数据
	 */
	data: {
		showTopTips: false,
		subscribePeriod: 0,
		subscribeDate: "1986-06-06",
		companyName: "",
		charge: "",
		description: "",
		radioItems: [
			{ name: '每月', value: 0, checked: true },
			{ name: '每年', value: 1 }
		],
		topTips: "",
		isBusy: false
	},
	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: function (options) {
		g_isEdit = options.action && options.action == "edit";//判断是否为更新
		if (g_isEdit) {
			g_itemID = options.id;
			wx.setNavigationBarTitle({
				title: '更新订阅'
			});
		}
		else {
			wx.setNavigationBarTitle({
				title: '添加订阅'
			});
		}
		this.initData(g_itemID);
	},
	//显示提示信息
	showTopTips: function (notifyText) {
		var that = this;
		that.setData({
			showTopTips: true,
			topTips: notifyText
		});
		setTimeout(function () {
			that.setData({
				showTopTips: false
			});
		}, 3000);
	},
	//单选框改变事件
	radioChange: function (e) {
		var that = this;
		var radioItems = that.data.radioItems;
		for (var i = 0, len = radioItems.length; i < len; ++i) {
			radioItems[i].checked = radioItems[i].value == e.detail.value;
		}

		that.setData({
			radioItems: radioItems,
			subscribePeriod: e.detail.value
		});
	},
	//日期变更事件
	bindDateChange: function (e) {
		this.setData({
			subscribeDate: e.detail.value
		});
	},
	//初始化数据
	initData: function (id) {
		var that = this;
		wx.showLoading({
			title: "辛勤加载中"
		});
		if (g_isEdit && id) {//初始化将更新项目信息
			var SubscribeItemList = new wx.BaaS.TableObject(g_app.globalData.subscribeItemListTableID);
			SubscribeItemList.get(id).then((res) => {
				if (res.data) {
					var item = res.data;
					if (item.payment_period == 1) {
						that.setData({
							radioItems: [
								{ name: '每月', value: 0, },
								{ name: '每年', value: 1, checked: true }
							]
						});
					}
					var subscribeDate = new Date(item.start_date);
					var subscribeDateString = subscribeDate.getFullYear().toString() + "-" + (subscribeDate.getMonth() + 1).toString() + "-" + subscribeDate.getDate().toString();
					that.setData({
						subscribePeriod: item.payment_period,
						subscribeDate: subscribeDateString,
						companyName: item.company_name,
						charge: item.charge,
						description: item.description
					});
				}
				//获取公司编码库
				that.initSubscribeCompany();
			}, (err) => {
				// err
			})
		}
		else {//初始化添加信息
			var today = new Date();
			that.setData({
				subscribeDate: today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate()
			});
			//获取公司编码库
			that.initSubscribeCompany();
		}
	},
	initSubscribeCompany: function () {
		var SubscribeCompany = new wx.BaaS.TableObject(g_app.globalData.subscribeCompanyTableID);
		//获取所有数据.todo:不能查单值和返回所有数据
		SubscribeCompany.limit(0).offset(0).find().then((res) => {
			var list = res.data.objects;
			if (list) g_companyCodeMap = list;
			wx.hideLoading();
		}, (err) => {
			// err
			wx.hideLoading();
		});
	},
	//提交表单
	formSubmit: function (e) {
		var that = this;
		var subscribeItem = e.detail.value;
		//校验数据
		var notifyTextArr = [];
		var subscribeName = subscribeItem.subscribeName.toString();
		if (!subscribeName || (subscribeName.replace(/(^s*)|(s*$)/g, "").length == 0)) notifyTextArr.push("名称");
		var subscribeCharge = parseFloat(subscribeItem.subscribeCharge);
		if (!subscribeCharge || isNaN(subscribeCharge)) notifyTextArr.push("费用");

		if (notifyTextArr.length > 0) {
			var notifyText = "请输入有效的信息：" + notifyTextArr.join();
			that.showTopTips(notifyText);
			return;
		};
		that.setData({
			isBusy: true
		});

		var SubscribeItemList = new wx.BaaS.TableObject(g_app.globalData.subscribeItemListTableID);
		var subscribeItemList = g_isEdit ? SubscribeItemList.getWithoutData(g_itemID)
			: SubscribeItemList.create();

		//获取表单信息
		var subscribeName = subscribeItem.subscribeName;
		subscribeItemList.set('company_name', subscribeName);
		//查找匹配的code
		var companyCode = "default";
		for (var i = 0; i < g_companyCodeMap.length; i++) {
			if (g_companyCodeMap[i].company_name_array.indexOf(subscribeName) != -1) {
				companyCode = g_companyCodeMap[i].company_code;
				break;
			}
		}
		subscribeItemList.set('company_code', companyCode);
		subscribeItemList.set('payment_period', parseInt(subscribeItem.subscribePeriod));
		subscribeItemList.set('charge', parseInt(subscribeItem.subscribeCharge));
		var chargeDay = new Date(subscribeItem.subscribeDate).getDate();
		subscribeItemList.set('start_date', subscribeItem.subscribeDate);
		subscribeItemList.set('charge_day', chargeDay);
		subscribeItemList.set('description', subscribeItem.subscribeDescription);

		if (g_isEdit) {//更新订阅
			subscribeItemList.update().then((res) => {
				that.setData({
					isBusy: false
				});
				wx.showToast({
					title: '更新成功',
					icon: 'success',
					duration: 3000,
					complete: function () {
						wx.reLaunch({
							url: '../index/index?refresh=true&action=update',
						});
					}
				});
			}, (err) => {
				that.setData({
					isBusy: false
				});
				wx.showToast({
					title: '更新失败请重试',
					icon: 'loading',
					duration: 2000
				})
			});
		}
		else {//添加订阅
			//todo:防止登录信息失效
			var uid = wx.BaaS.storage.get('uid');//设置用户ID
			subscribeItemList.set('user_id', uid);
			subscribeItemList.save().then((res) => {
				that.setData({
					isBusy: false
				});
				wx.showToast({
					title: '添加成功',
					icon: 'success',
					duration: 3000,
					complete: function () {
						wx.reLaunch({
							url: '../index/index?refresh=true&action=add',
						});
					}
				});
			}, (err) => {
				that.setData({
					isBusy: false
				});
				wx.showToast({
					title: '添加失败请重试',
					icon: 'loading',
					duration: 2000
				})
			});
		}
	}
});

