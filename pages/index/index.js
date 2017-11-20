//index.js
//获取应用实例
const g_app = getApp();
const g_pageSize = 7;
var g_pageIndex = 1;
var g_isRefresh = false;
Page({
	data: {
		userInfo: {},
		hasUserInfo: false,
		canIUse: wx.canIUse('button.open-type.getUserInfo'),
		subscribeCountInfo: {
			//thisMonthPaid: 300,
			thisMonthTotal: 0,
			thisYearTotal: 0,
			subscribeTotal: 0
		},
		subscribeList: [],
		recentSubscribeList: [],
		srcImageArrow: g_app.globalData.qiniuyunPath + 'image/icon/arrow-up.png',
		totalCount: 0,
		isLoading: false,
		isEmpty: false,
		isRecentListEmpty: false
	},
	//事件处理函数
	onLoad: function (optinons) {
		//初始化数据
		if (optinons && optinons.refresh) g_isRefresh = true;
		this.loadCountData();
	},
	onShow: function () {
		//重新加载时刷新数据
		if (g_isRefresh) {
			this.loadCountData();
			this.data.subscribeList = [];
			g_pageIndex = 1;
		}
	},
	loadCountData: function () {
		var that = this;
		wx.showLoading({
			title: "辛勤加载中"
		});
		var SubscribeItemList = new wx.BaaS.TableObject(g_app.globalData.subscribeItemListTableID);
		//获取所有数据.todo:不能查单值和返回所有数据
		var uid = wx.BaaS.storage.get('uid');
		var query = new wx.BaaS.Query();
		query.compare('user_id', '=', uid);
		//todo:防止登录信息失效
		SubscribeItemList.setQuery(query).limit(1000).offset(0).find().then((res) => {
			var list = res.data.objects;
			var recentList = [];
			var listCount = res.data.meta;
			var thisMonthTotal = 0;
			var thisYearTotal = 0;
			var item;
			var thisDate = new Date();
			var thisYear = thisDate.getFullYear();
			var thisMonth = thisDate.getMonth() + 1;
			var thisDay = thisDate.getDate();
			var startDate = new Date();
			var maxDay = thisDay + 7;
			var isRecentDay = false;
			for (var i = 0; i < list.length; i++) {
				item = list[i];
				startDate = new Date(item.start_date);
				//按月付费计算累加费用
				isRecentDay = (item.charge_day >= thisDay && item.charge_day < maxDay) || item.charge_day <= (maxDay - 30)
				if (item.payment_period == 0) {
					thisMonthTotal += item.charge;
					item.period_text = '月';
					if (isRecentDay) {
						item.left_days = maxDay - item.charge_day;
						recentList.push(item);
					}
				}
				else if (item.payment_period == 1) {//按年付费累加费用
					thisYearTotal += item.charge;
					item.period_text = '年';
					if (startDate.getFullYear() <= thisYear && (startDate.getMonth() + 1) == thisMonth && isRecentDay) {
						item.left_days = maxDay - item.charge_day;
						recentList.push(item);
					}
				}
			}
			//更新视图
			that.setData({
				subscribeCountInfo: {
					thisMonthTotal: thisMonthTotal,
					thisYearTotal: thisYearTotal,
					subscribeTotal: listCount.total_count
				},
				recentSubscribeList: recentList
			});
			if (recentList.length == 0) {
				that.setData({
					isRecentListEmpty: true
				});
			}
			wx.hideLoading();
		}, (err) => {
			// err
			wx.hideLoading();
		});
		//this.drawProgress();
	},
	loadSubscribeList: function (pageIndex) {
		var that = this;
		that.setData({
			isLoading: true
		});
		var SubscribeItemList = new wx.BaaS.TableObject(g_app.globalData.subscribeItemListTableID);
		var uid = wx.BaaS.storage.get('uid');
		var query = new wx.BaaS.Query();
		query.compare('user_id', '=', uid);
		//todo:防止登录信息失效
		SubscribeItemList.setQuery(query).limit(pageIndex * g_pageSize).offset((pageIndex - 1) * g_pageSize).orderBy('-created_at').find().then((res) => {
			var list = res.data.objects;
			if (list.length == 0)//没有数据返回
			{
				that.setData({
					isEmpty: true,
					isLoading: false
				});
				return;
			}
			var item;
			var start_date;
			for (var i = 0; i < list.length; i++) {
				item = list[i];
				item.period_text = "月";
				if (item.payment_period == 1) {
					item.period_text = "年";
					start_date = new Date(item.start_date);
					item.charge_day = (start_date.getMonth() + 1).toString() + "月" + item.charge_day.toString();
				}
				else {
					item.charge_day = "每月" + item.charge_day.toString();
				}
			}
			list = that.data.subscribeList.concat(list);
			//更新视图
			that.setData({
				subscribeList: list,
				totalCount: res.data.meta.total_count,
				isLoading: false
			});
		}, (err) => {
			// err
			that.setData({
				isLoading: false
			});
		});
	},
	//跳转到添加订阅页面
	addSubscribeItem: function () {
		wx.navigateTo({
			url: '../addItem/addItem',
		})
	},
	changeMainSwiper: function (e) {
		var currentIndex = e.detail.current;
		var src = g_app.globalData.qiniuyunPath + 'image/icon/';
		src = currentIndex == 1 ? src + 'arrow-down.png' : src + 'arrow-up.png';
		this.setData({
			srcImageArrow: src
		});
		//加载列表数据,不重复加载
		if (currentIndex == 1 && this.data.subscribeList.length == 0) {
			g_pageIndex = 1;
			this.loadSubscribeList(g_pageIndex);
		}
	},
	scrollToUpper: function (e) {

	},
	scrollToLower: function (e) {
		//加载更多数据
		if (this.data.subscribeList.length < this.data.totalCount) {
			this.setData({
				isLoading: true
			});
			this.loadSubscribeList(++g_pageIndex);
		}
	},
	drawProgress: function () {

		var ctx = wx.createCanvasContext('canvasProgressBackground');
		ctx.setLineWidth(6);
		ctx.setStrokeStyle('#3ea6ff');
		ctx.setLineCap('round');
		ctx.beginPath();//开始一个新的路径 
		ctx.arc(106, 106, 100, -Math.PI * 1 / 2, Math.PI * 1.5, false);
		ctx.stroke();//对当前路径进行描边 
		ctx.draw();
		//todo:计算已缴纳费用，画进度
		/*var thisMonthPaid = this.data.subscribeCountInfo.thisMonthPaid;
		var thisMonthTotal = this.data.subscribeCountInfo.thisMonthTotal;

		var ctx = wx.createCanvasContext('canvasProgressBackground');
		ctx.setLineWidth(6);
		ctx.setStrokeStyle('#b2b2b2');
		ctx.setLineCap('round')
		ctx.beginPath();//开始一个新的路径 
		ctx.arc(106, 106, 100, 0, 2 * Math.PI, false);//设置一个原点(106,106)，半径为100的圆的路径到当前路径 
		ctx.stroke();//对当前路径进行描边 

		//3秒动画描绘进度
		if (thisMonthTotal == 0) {
			ctx.draw();
			return;
		}
		var ratio = Math.PI * 1.5 * (thisMonthPaid / thisMonthTotal);

		ctx.setLineWidth(6);
		ctx.setStrokeStyle('#3ea6ff');
		ctx.setLineCap('round');
		ctx.beginPath();//开始一个新的路径 
		ctx.arc(106, 106, 100, -Math.PI * 1 / 2, ratio, false);
		ctx.stroke();//对当前路径进行描边 
		ctx.draw();
		*/

	}
});


