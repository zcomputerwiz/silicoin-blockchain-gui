import React, { useEffect, useMemo, useState } from 'react';
import { Trans } from '@lingui/macro';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import { State } from '@chia/core';
import type { RootState } from '../../../modules/rootReducer';
import FarmCard from './FarmCard';
import type Plot from '../../../types/Plot';
import FullNodeState from '../../../constants/FullNodeState';
import useFullNodeState from '../../../hooks/useFullNodeState';
import FarmCardNotAvailable from './FarmCardNotAvailable';
import { address_to_puzzle_hash } from '../../pool/address_to_puzzle_hash';
import { get_plots, get_coin_records_by_puzzle_hash } from '../../../modules/fullnodeMessages';

const MINUTES_PER_BLOCK = (24 * 60) / 4608; // 0.3125

export default function FarmCardExpectedTimeToWin() {
  const fullNodeState = useFullNodeState();
  const dispatch = useDispatch();

  const plots: Plot[] | undefined = useSelector(
    (state: RootState) => state.farming_state.harvester.plots,
  );
  const totalNetworkSpace = useSelector(
    (state: RootState) => state.full_node_state.blockchain_state?.space ?? 0,
  );

  const farmerSpace = useMemo(() => {
    if (!plots) {
      return 0;
    }

    return plots.map((p: Plot) => p.file_size).reduce((a, b) => a + b, 0);
  }, [plots]);

  const farmerPublicKeyAddress: string[] = [];

  if(plots){

    for (let p of plots){

      if(p.farmer_puzzle_address && !farmerPublicKeyAddress.includes(p.farmer_puzzle_address)){
        // console.log("The farmer puzzle address is : ")
        // console.log(p.farmer_puzzle_address)
        farmerPublicKeyAddress.push(p.farmer_puzzle_address);
      }
    }
  }

  const [stakingFactor, setStakingFactor] = useState(0);
  const [stakingFactorStr, setStakingFactorStr] = useState("0.0");
  const [expectedTimeToWin, setExpectedfTimeToWin] = useState("");
  const [proportion, setProportion] = useState(0);

  let stakingFactorFarmerSpace = farmerSpace;
  let stakingBalance = 0.0;

  useMemo(() => {

    async function getStakingBalance() {

      // console.log("Begin to get staking balance");
      // console.log(farmerPublicKeyAddress);

      for(let address of farmerPublicKeyAddress){
        try {

          console.log(address);
          let puzzlehash = address_to_puzzle_hash(address)
          const data = await dispatch(get_coin_records_by_puzzle_hash(puzzlehash));
          console.log(data);
          if (data.success) {
            let amount = sumCoins(data.coin_records)
            stakingBalance += amount
          } else {
            alert(data.error)
          }
        } catch (error) {
          alert(error)
        }
      }
      
      setStakingFactor(calculateStakingFactor(stakingBalance, farmerSpace));
      setStakingFactorStr(stakingFactor.toFixed(2))
      stakingFactorFarmerSpace = farmerSpace / stakingFactor;

      console.log("Staking Balance : ");
      console.log(stakingBalance);

      setProportion(totalNetworkSpace ? stakingFactorFarmerSpace / totalNetworkSpace : 0);

      // console.log("Proportion : ");
      // console.log(proportion);

      const minutes = proportion ? MINUTES_PER_BLOCK / proportion : 0;

      // console.log("Expected Minutes : ");
      // console.log(minutes);

      setExpectedfTimeToWin(moment.duration({ minutes }).humanize());
    }

    getStakingBalance();

  }, [farmerPublicKeyAddress]);

  // stakingFactor = calculateStakingFactor(stakingBalance, farmerSpace);
  // stakingFactorFarmerSpace = farmerSpace / stakingFactor;

  // const proportion = totalNetworkSpace ? stakingFactorFarmerSpace / totalNetworkSpace : 0;

  // const minutes = proportion ? MINUTES_PER_BLOCK / proportion : 0;

  //const expectedTimeToWin = moment.duration({ minutes }).humanize();

  if (fullNodeState !== FullNodeState.SYNCED) {
    const state =
      fullNodeState === FullNodeState.SYNCHING ? State.WARNING : undefined;

    return (
      <FarmCardNotAvailable
        title={<Trans>Estimated Time to Win</Trans>}
        state={state}
      />
    );
  }

  return (
    <FarmCard
      title={<Trans>Estimated Time to Win</Trans>}
      value={`${expectedTimeToWin}`}
      tooltip={
        <Trans>
          You have {(proportion * 100).toFixed(4)}% of the space on the network,
          so farming a block will take {expectedTimeToWin} in expectation.
          Actual results may take 3 to 4 times longer than this estimate.
        </Trans>
      }
      description={<Trans>Estimated Staking Factor: {stakingFactorStr}</Trans>}
    />
  );

  function sumCoins(records:any[]): number {

    var total: number = 0
    var temp = new Array()
    for(let record of records) {
      var amount: number = record.coin.amount  
      total += amount
      temp.push(record.coin)
    }

    return total / 1000000000000
  }

  function calculateStakingFactor(stakingBalance: number, farmerSpace: number): number{
    let sf = 0;

    if (farmerSpace == 0){
        return 1.0
    }

    //convert farmer space from byte to T unit
    let convertedFarmerSpace = farmerSpace / 1000000000000

    if (stakingBalance >= convertedFarmerSpace){
        sf = 0.5 + 1.0 / (stakingBalance / convertedFarmerSpace + 1.0)
    }else{
        sf = 0.05 + 1.0 / (stakingBalance / convertedFarmerSpace + 0.05)
    }

    return sf;
  }
}
