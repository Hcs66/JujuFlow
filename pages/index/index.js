//index.js
//获取应用实例
const g_app = getApp();
const g_buttonDeleteWidth = 100;
const g_subscribeItemHeight = 90;
const g_listHeaderHeight = 47;
var g_pageIndex = 1;
var g_pageSize = 10;
var g_startX = 0;
var g_needRefreshCount = false;
Page({
	data: {
		subscribeCountInfo: {
			thisMonthTotal: 0,
			thisYearTotal: 0,
			subscribeTotal: 0
		},
		subscribeList: [],
		recentSubscribeList: [],
		imageArrowSrc: 'arrow-up.png',
		totalCount: 0,
		isLoadingList: false,
		qiniuyunPath: g_app.globalData.qiniuyunPath,
		clientHeight: 0,
		isBusy: false
	},
	//页面加载事件
	onLoad: function (optinons) {
		var that = this;
		//初始化数据
		g_pageIndex = 1;
		this.setData({
			subscribeList: []
		});
		wx.getSystemInfo({
			success: function (res) {
				//根据实际高度调整显示数量
				that.setData({
					clientHeight: res.windowHeight - g_listHeaderHeight
				});
				g_pageSize = Math.ceil(that.data.clientHeight / g_subscribeItemHeight);
				//加载数据
				that.loadCountData();
			}
		});
	},
	//加载统计数据和最近到期订阅
	loadCountData: function () {
		var that = this;
		wx.showLoading({
			title: "辛勤加载中"
		});
		var SubscribeItemList = new wx.BaaS.TableObject(g_app.globalData.subscribeItemListTableID);
		//获取当前用户数据,todo:不能查单值
		var uid = wx.BaaS.storage.get('uid');
		var query = new wx.BaaS.Query();
		query.compare('user_id', '=', uid);
		//todo:防止登录信息失效
		SubscribeItemList.setQuery(query).limit(0).offset(0).find().then((res) => {
			var list = res.data.objects;
			var recentList = [];
			var listCount = res.data.meta;
			var thisMonthTotal = 0;
			var thisYearTotal = 0;
			var thisDate = new Date();
			var thisYear = thisDate.getFullYear();
			var thisMonth = thisDate.getMonth() + 1;
			var thisDay = thisDate.getDate();
			var startDate = new Date();
			var maxDay = thisDay + 7;
			var isRecentDay = false;
			var item;
			for (var i = 0; i < list.length; i++) {
				item = list[i];
				startDate = new Date(item.start_date);
				//按月付费计算累加费用
				isRecentDay = (item.charge_day >= thisDay && item.charge_day < maxDay) || item.charge_day <= (maxDay - 30);
				if (item.payment_period == 0) {
					thisMonthTotal += item.charge;
					item.period_text = '月';
				}
				else if (item.payment_period == 1) {//按年付费累加费用
					thisYearTotal += item.charge;
					item.period_text = '年';
					isRecentDay = startDate.getFullYear() <= thisYear && (startDate.getMonth() + 1) == thisMonth && isRecentDay;
				}
				if (isRecentDay) {
					item.left_days = item.charge_day >= thisDay ? (item.charge_day - thisDay) : (item.charge_day + 30 - thisDay);
					recentList.push(item);
				}
			};
			//更新视图
			that.setData({
				subscribeCountInfo: {
					thisMonthTotal: thisMonthTotal,
					thisYearTotal: thisYearTotal,
					subscribeTotal: listCount.total_count
				},
				recentSubscribeList: recentList
			});
			g_needRefreshCount = false;
			wx.hideLoading();
		}, (err) => {
			// err
			wx.hideLoading();
		});
	},
	//加载所有订阅列表
	loadSubscribeList: function (pageIndex) {
		var that = this;
		that.setData({
			isLoadingList: true
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
					isLoadingList: false
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
				isLoadingList: false
			});
		}, (err) => {
			// err
			that.setData({
				isLoadingList: false
			});
		});
	},
	//swiper切换事件
	changeMainSwiper: function (e) {
		var currentIndex = e.detail.current;
		this.setData({
			imageArrowSrc: currentIndex == 1 ? 'arrow-down.png' : 'arrow-up.png'
		});
		//如果列表数据为空，加载列表数据
		if (currentIndex == 1 && this.data.subscribeList.length == 0) {
			g_pageIndex = 1;
			this.loadSubscribeList(g_pageIndex);
		}
		else if (currentIndex == 0 && g_needRefreshCount) this.loadCountData();
	},
	//跳转到添加订阅页面
	addSubscribeItem: function () {
		wx.navigateTo({
			url: '../editItem/editItem?action=add',
		})
	},
	//scrollview滑动到底部事件
	scrollToLower: function (e) {
		//加载更多数据
		if (!this.data.isLoadingList && this.data.subscribeList.length < this.data.totalCount)
			this.loadSubscribeList(++g_pageIndex);
	},
	//触摸开始事件
	touchStart: function (e) {
		//判断是否只有一个触摸点
		if (e.touches.length == 1) {
			//记录触摸起始位置的X坐标
			g_startX = e.touches[0].clientX;
		}
	},
	//触摸移动事件
	touchMove: function (e) {
		if (e.touches.length == 1) {
			var that = this;
			//记录触摸点位置的X坐标
			var moveX = e.touches[0].clientX;
			//计算手指起始点的X坐标与当前触摸点的X坐标的差值
			var disX = g_startX - moveX;
			var itemStyle = "";
			if (disX == 0 || disX < 0 || disX < 10) {//如果移动距离小于等于0，或者移动距离少于10px，文本层位置不变
				itemStyle = "left:0px";
			} else if (disX > 0) {//移动距离大于0，文本层left值等于手指移动距离
				itemStyle = "left:-" + disX + "px";
				if (disX >= g_buttonDeleteWidth) {
					//控制手指移动距离最大值为删除按钮的宽度
					itemStyle = "left:-" + g_buttonDeleteWidth + "px";
				}
			}
			//获取手指触摸的是哪一个item
			var index = e.currentTarget.dataset.index;
			var list = that.data.subscribeList;
			//将拼接好的样式设置到当前item中
			list[index].itemStyle = itemStyle;
			//更新列表的状态
			that.setData({
				subscribeList: list
			});
		}
	},
	//触摸结束事件
	touchEnd: function (e) {
		var that = this;
		if (e.changedTouches.length == 1) {
			//手指移动结束后触摸点位置的X坐标
			var endX = e.changedTouches[0].clientX;
			//触摸开始与结束，手指移动的距离
			var disX = g_startX - endX;
			//如果距离小于删除按钮的1/2，不显示删除按钮
			var itemStyle = disX > g_buttonDeleteWidth / 2 ? "left:-" + g_buttonDeleteWidth + "px" : "left:0px";
			//获取手指触摸的是哪一项
			var index = e.currentTarget.dataset.index;
			var list = that.data.subscribeList;
			list[index].itemStyle = itemStyle;
			//更新列表的状态
			that.setData({
				subscribeList: list
			});
		}
	},
	//删除订阅
	deleteItem: function (e) {
		var that = this;
		var index = e.currentTarget.dataset.index;
		var list = that.data.subscribeList;
		var item = list[index];
		wx.showModal({
			title: '提示',
			content: '确定删除吗？',
			success: function (res) {
				if (res.confirm) {
					//处理时禁用删除按钮
					that.setData({
						isBusy: true
					});
					//删除记录
					var recordID = item.id;
					var SubscribeItemList = new wx.BaaS.TableObject(g_app.globalData.subscribeItemListTableID);
					SubscribeItemList.delete(recordID).then((res) => {
						// 删除成功，提示并重新加载列表
						that.setData({
							isBusy: false,
							subscribeList: []
						});
						g_needRefreshCount = true;//标记更新，切换回统计页面时需要更新
						g_pageIndex = 1;
						that.loadSubscribeList(g_pageIndex);
						wx.showToast({
							title: '删除成功',
							icon: 'success',
							duration: 3000
						});
					}, (err) => {
						that.setData({
							isBusy: false
						});
						wx.showToast({
							title: '删除失败,请重试',
							icon: 'success',
							duration: 3000
						});
					})

				} else if (res.cancel) {
					item.itemStyle = "left:0px";
					that.setData({
						isBusy: false,
						subscribeList: list
					});
				}
			}
		})
	}
});


