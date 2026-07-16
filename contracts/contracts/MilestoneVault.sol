// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MilestoneVault {
    // ───── Enums ─────
    enum AgreementStatus { Created, Funded, Active, Completed, Disputed }
    enum MilestoneStatus { Pending, Requested, Approved, Rejected }
    enum RequestType    { Milestone, AdHoc }
    enum RequestStatus  { Pending, Approved, Rejected, Disputed }

    // ───── Structs ─────
    struct Milestone {
        string       description;
        uint256      percentage;   // out of 100
        MilestoneStatus status;
    }

    struct Request {
        uint256       id;
        RequestType   reqType;
        uint256       milestoneIndex; // ignored for AdHoc
        uint256       amount;
        string        reason;         // evidence link for Milestone, text for AdHoc
        RequestStatus status;
    }

    // ───── State ─────
    address public investor;
    address public builder;
    address public arbiter;

    uint256 public totalDeposited;
    uint256 public totalReleased;

    AgreementStatus public status;

    Milestone[] public milestones;
    Request[]   public requests;

    // ───── Events ─────
    event Deposited(address indexed investor, uint256 amount);
    event AgreementAccepted(address indexed builder);
    event RequestCreated(uint256 indexed requestId, RequestType reqType, uint256 amount);
    event RequestApproved(uint256 indexed requestId, uint256 amount);
    event RequestRejected(uint256 indexed requestId);
    event DisputeRaised(uint256 indexed requestId);
    event DisputeResolved(uint256 indexed requestId, bool releasedToBuilder);

    // ───── Modifiers ─────
    modifier onlyInvestor() {
        require(msg.sender == investor, "MV: caller is not investor");
        _;
    }
    modifier onlyBuilder() {
        require(msg.sender == builder, "MV: caller is not builder");
        _;
    }
    modifier onlyArbiter() {
        require(msg.sender == arbiter, "MV: caller is not arbiter");
        _;
    }

    // ───── Constructor ─────
    constructor(
        address _investor,
        address _builder,
        address _arbiter,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestonePercentages
    ) {
        require(_milestoneDescriptions.length > 0, "MV: no milestones");
        require(
            _milestoneDescriptions.length == _milestonePercentages.length,
            "MV: length mismatch"
        );

        uint256 total;
        for (uint256 i = 0; i < _milestonePercentages.length; i++) {
            require(_milestonePercentages[i] > 0, "MV: zero percentage");
            total += _milestonePercentages[i];
        }
        require(total == 100, "MV: percentages must sum to 100");

        investor = _investor;
        builder  = _builder;
        arbiter  = _arbiter;
        status   = AgreementStatus.Created;

        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            milestones.push(Milestone({
                description: _milestoneDescriptions[i],
                percentage:  _milestonePercentages[i],
                status:      MilestoneStatus.Pending
            }));
        }
    }

    // ───── Core Functions ─────

    /// @notice Investor deposits full escrow amount (native MON).
    function deposit() external payable onlyInvestor {
        require(status == AgreementStatus.Created, "MV: not in Created state");
        require(msg.value > 0, "MV: must deposit > 0");
        totalDeposited += msg.value;
        status = AgreementStatus.Funded;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Builder accepts the agreement after it is funded.
    function acceptAgreement() external onlyBuilder {
        require(status == AgreementStatus.Funded, "MV: not funded");
        status = AgreementStatus.Active;
        emit AgreementAccepted(msg.sender);
    }

    /// @notice Builder requests payout for a specific milestone.
    function requestMilestonePayout(
        uint256 milestoneIndex,
        string calldata evidenceLink
    ) external onlyBuilder {
        require(status == AgreementStatus.Active, "MV: not active");
        require(milestoneIndex < milestones.length, "MV: invalid milestone index");
        require(
            milestones[milestoneIndex].status == MilestoneStatus.Pending,
            "MV: milestone not pending"
        );

        uint256 amount = (totalDeposited * milestones[milestoneIndex].percentage) / 100;
        require(amount <= remainingLocked(), "MV: insufficient locked funds");

        uint256 requestId = requests.length;
        requests.push(Request({
            id:             requestId,
            reqType:        RequestType.Milestone,
            milestoneIndex: milestoneIndex,
            amount:         amount,
            reason:         evidenceLink,
            status:         RequestStatus.Pending
        }));

        milestones[milestoneIndex].status = MilestoneStatus.Requested;
        emit RequestCreated(requestId, RequestType.Milestone, amount);
    }

    /// @notice Builder requests an ad-hoc payout (partial, any reason).
    function requestAdHoc(uint256 amount, string calldata reason) external onlyBuilder {
        require(status == AgreementStatus.Active, "MV: not active");
        require(amount > 0, "MV: amount must be > 0");
        require(amount <= remainingLocked(), "MV: exceeds remaining locked");

        uint256 requestId = requests.length;
        requests.push(Request({
            id:             requestId,
            reqType:        RequestType.AdHoc,
            milestoneIndex: 0,
            amount:         amount,
            reason:         reason,
            status:         RequestStatus.Pending
        }));

        emit RequestCreated(requestId, RequestType.AdHoc, amount);
    }

    /// @notice Investor approves a pending request → releases funds to builder.
    function approveRequest(uint256 requestId) external onlyInvestor {
        require(requestId < requests.length, "MV: invalid request id");
        Request storage req = requests[requestId];
        require(req.status == RequestStatus.Pending, "MV: request not pending");
        require(req.amount <= remainingLocked(), "MV: insufficient locked funds");

        req.status = RequestStatus.Approved;
        if (req.reqType == RequestType.Milestone) {
            milestones[req.milestoneIndex].status = MilestoneStatus.Approved;
        }

        totalReleased += req.amount;
        (bool ok, ) = payable(builder).call{value: req.amount}("");
        require(ok, "MV: transfer failed");

        emit RequestApproved(requestId, req.amount);
    }

    /// @notice Investor rejects a pending request.
    function rejectRequest(uint256 requestId) external onlyInvestor {
        require(requestId < requests.length, "MV: invalid request id");
        Request storage req = requests[requestId];
        require(req.status == RequestStatus.Pending, "MV: request not pending");

        req.status = RequestStatus.Rejected;
        if (req.reqType == RequestType.Milestone) {
            milestones[req.milestoneIndex].status = MilestoneStatus.Rejected;
        }

        emit RequestRejected(requestId);
    }

    /// @notice Builder raises a dispute after investor rejection.
    function raiseDispute(uint256 requestId) external onlyBuilder {
        require(requestId < requests.length, "MV: invalid request id");
        Request storage req = requests[requestId];
        require(req.status == RequestStatus.Rejected, "MV: request not rejected");

        req.status = RequestStatus.Disputed;
        status     = AgreementStatus.Disputed;

        emit DisputeRaised(requestId);
    }

    /// @notice Arbiter resolves a disputed request.
    /// @param releaseToBuilder If true, funds are released to builder. If false, funds stay locked.
    function resolveDispute(uint256 requestId, bool releaseToBuilder) external onlyArbiter {
        require(requestId < requests.length, "MV: invalid request id");
        Request storage req = requests[requestId];
        require(req.status == RequestStatus.Disputed, "MV: request not disputed");

        if (releaseToBuilder) {
            require(req.amount <= remainingLocked(), "MV: insufficient locked funds");
            req.status = RequestStatus.Approved;
            if (req.reqType == RequestType.Milestone) {
                milestones[req.milestoneIndex].status = MilestoneStatus.Approved;
            }
            totalReleased += req.amount;
            (bool ok, ) = payable(builder).call{value: req.amount}("");
            require(ok, "MV: transfer failed");
        } else {
            req.status = RequestStatus.Rejected;
            if (req.reqType == RequestType.Milestone) {
                milestones[req.milestoneIndex].status = MilestoneStatus.Rejected;
            }
        }

        // Resume agreement if no more disputes
        status = AgreementStatus.Active;
        emit DisputeResolved(requestId, releaseToBuilder);
    }

    // ───── View Functions ─────

    function remainingLocked() public view returns (uint256) {
        return totalDeposited - totalReleased;
    }

    function getMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }

    function getRequests() external view returns (Request[] memory) {
        return requests;
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getRequestCount() external view returns (uint256) {
        return requests.length;
    }
}
